import pg, { type PoolConfig, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import type { Pool as PgPool } from 'pg';
// Aliased: pg exports a DatabaseError too, and ours is the one that gets thrown.
const { Pool, DatabaseError: PgDatabaseError } = pg;
import { logger } from './logger.js';
import { AppError, ConfigError, DatabaseError, toError } from './errors.js';

/**
 * Read an integer from the environment, rejecting values that are not numbers.
 *
 * `parseInt(undefined)` is NaN and `parseInt('8080abc')` is 8080; both used to be
 * passed straight to pg, which fails later and confusingly.
 */
function envInt(value: string | undefined, fallback: number, name: string): number {
    if (value === undefined || value.trim() === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ConfigError(`${name} must be a positive integer, got "${value}"`, {
            userMessage: 'The bot is misconfigured and cannot start.',
        });
    }
    return parsed;
}

/**
 * Whether to verify the database server's TLS certificate.
 *
 * This used to be `NODE_ENV === 'production' || NODE_ENV === undefined`, which meant
 * certificate verification was disabled by accident on any machine that had simply
 * not set NODE_ENV - the common case. It is now a deliberate setting.
 *
 * The default is still off, because the managed Postgres this bot connects to
 * presents a certificate that does not verify against the public roots, and turning
 * verification on without configuring a CA would take the bot down. That is a real
 * weakness rather than a solved problem: the connection is encrypted but not
 * authenticated, so it is not protected against an active man-in-the-middle.
 *
 *   DB_SSL=verify   verify the certificate (set DB_SSL_CA if a custom root is needed)
 *   DB_SSL=on       encrypt without verifying (the default, and the status quo)
 *   DB_SSL=off      no TLS at all - local databases only
 */
function sslConfig(): PoolConfig['ssl'] {
    const mode = (process.env.DB_SSL ?? '').toLowerCase()
        || (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' ? 'off' : 'on');

    switch (mode) {
        case 'off':
            return false;
        case 'on':
            return { rejectUnauthorized: false };
        case 'verify':
            return process.env.DB_SSL_CA
                ? { rejectUnauthorized: true, ca: process.env.DB_SSL_CA }
                : { rejectUnauthorized: true };
        default:
            throw new ConfigError(`DB_SSL must be one of off, on, verify - got "${process.env.DB_SSL}"`, {
                userMessage: 'The bot is misconfigured and cannot start.',
            });
    }
}

function buildPoolConfig(): PoolConfig {
    if (!process.env.DATABASE) {
        throw new ConfigError('DATABASE is not set', {
            userMessage: 'The bot is misconfigured and cannot start.',
        });
    }
    return {
        user: process.env.DBUSER,
        password: process.env.DBPASS || '',
        host: process.env.HOST,
        database: process.env.DATABASE,
        // DBPORT is the unambiguous name. PORT is still honoured because deployed
        // environments set it, but it is the conventional name for an HTTP port - the
        // auth site uses AUTH_PORT - so the two are easy to confuse. The old fallback
        // when neither was set was `0`, which is not a port; pg then asked the OS for an
        // ephemeral one and the connection failed somewhere far from the cause.
        port: envInt(process.env.DBPORT ?? process.env.PORT, 5432, 'DBPORT'),
        ssl: sslConfig(),
        // A query that runs longer than this is cancelled by the server. Without it a
        // single stuck query holds a pool connection until the process restarts, and ten
        // of them deadlock the bot. This was written and then commented out.
        statement_timeout: envInt(process.env.DB_STATEMENT_TIMEOUT_MS, 15000, 'DB_STATEMENT_TIMEOUT_MS'),
        connectionTimeoutMillis: 5000,
        // Was 2000, which closed connections after two seconds idle and made the bot
        // reconnect constantly between feed polls - TLS handshake and all.
        idleTimeoutMillis: 30000,
        max: 10,
    };
}

/**
 * Configuration and pools are built on first use rather than at import.
 *
 * Building them at module scope meant that importing anything in the data layer -
 * including from a test, or from the migration runner, which has no interest in the
 * automod database - evaluated every environment variable and threw if one was
 * missing. Deferring it keeps the validation (a missing setting still fails loudly)
 * without making the module unimportable.
 */
let cachedConfig: PoolConfig | undefined;

export function poolConfig(): PoolConfig {
    cachedConfig ??= buildPoolConfig();
    return cachedConfig;
}

/** The pools this module can query. `main` is the bot's database; `automod` is the rules database. */
export type PoolName = 'main' | 'automod';

const pools = new Map<PoolName, PgPool>();

function getPool(name: PoolName): PgPool {
    let existing = pools.get(name);
    if (existing) return existing;

    if (name === 'automod') {
        // If AUTOMOD_DATABASE is unset, pg does not complain: it falls back to
        // PGDATABASE and then to the *user name* as the database name. A missing
        // setting therefore pointed the automod rules API at a different database
        // entirely, or failed at connect time naming a database nobody configured.
        if (!process.env.AUTOMOD_DATABASE) {
            throw new ConfigError('AUTOMOD_DATABASE is not set', {
                context: { hint: 'The automod rules API needs its own database name. See .env.example.' },
                userMessage: 'The bot is misconfigured and cannot start.',
            });
        }
        existing = new Pool({ ...poolConfig(), database: process.env.AUTOMOD_DATABASE });
    }
    else {
        existing = new Pool(poolConfig());
    }

    pools.set(name, existing);
    return existing;
}

/** Close every open pool. Used by tests and by graceful shutdown. */
export async function closePools(): Promise<void> {
    const open = [...pools.values()];
    pools.clear();
    cachedConfig = undefined;
    await Promise.all(open.map((p) => p.end().catch(() => undefined)));
}

/**
 * Run a query against one of the pools.
 *
 * This replaces `queryPromise` and `queryAutoMod`, which were the same twenty lines
 * twice over, differing only in which pool they took a client from and in the
 * wording of their log messages. `queryPromise` is kept as an alias below because
 * roughly half the data layer imports it under that name and the other half imports
 * the default export as `query`.
 */
export async function query<T extends QueryResultRow>(
    text: string,
    values?: unknown[],
    name?: string,
    poolName: PoolName = 'main',
): Promise<QueryResult<T>> {
    let client: PoolClient | undefined;

    try {
        client = await getPool(poolName).connect();
        return await client.query<T>({ text, values, name });
    }
    catch (err) {
        // values are deliberately not logged: for the users table they contain OAuth tokens.
        if (!client) logger.error('Error acquiring client', { query: text, pool: poolName, err: (err as Error).message });
        else logger.error('Error in query', { query: text, pool: poolName, valueCount: values?.length ?? 0, err });
        throw handleDatabaseError(err);
    }
    finally {
        client?.release();
    }
}

/** Run a query against the automod rules database. */
export async function queryAutoMod<T extends QueryResultRow>(
    text: string,
    values?: unknown[],
    name?: string,
): Promise<QueryResult<T>> {
    return query<T>(text, values, name, 'automod');
}

/**
 * Run several statements in one transaction, on one connection.
 *
 * There were no transactions anywhere in this codebase. `updateSavedNews` did a
 * DELETE and then an INSERT as two unrelated statements, so a crash or a failed
 * INSERT between them left the news table empty and lost the cursor entirely - the
 * next poll then treated every existing article as new.
 *
 * The callback gets a `tx` function with the same shape as `query`, bound to the
 * transaction's connection. Anything thrown rolls the transaction back and
 * propagates; returning normally commits.
 */
export async function withTransaction<R>(
    fn: (tx: <T extends QueryResultRow>(text: string, values?: unknown[], name?: string) => Promise<QueryResult<T>>) => Promise<R>,
    poolName: PoolName = 'main',
): Promise<R> {
    let client: PoolClient;
    try {
        client = await getPool(poolName).connect();
    }
    catch (err) {
        logger.error('Error acquiring client for transaction', { pool: poolName, err: (err as Error).message });
        throw handleDatabaseError(err);
    }

    try {
        await client.query('BEGIN');

        const tx = <T extends QueryResultRow>(text: string, values?: unknown[], name?: string) =>
            client.query<T>({ text, values, name });

        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        // A failed ROLLBACK must not replace the error that caused it.
        await client.query('ROLLBACK').catch((rollbackErr) => {
            logger.error('Rollback failed', { pool: poolName, err: rollbackErr });
        });
        logger.error('Transaction rolled back', { pool: poolName, err });
        // The callback may throw something already meaningful - a DatabaseError from a
        // nested query, or a domain error. Wrapping it again would bury the real cause
        // under a generic 'Unhandled database error'.
        if (err instanceof AppError) throw err;
        throw handleDatabaseError(err);
    }
    finally {
        client.release();
    }
}

/** @deprecated Prefer `query`. Kept because much of the data layer imports this name. */
export const queryPromise = query;

/**
 * Turn a pg failure into a DatabaseError.
 *
 * This used to be typed `: string` and every caller did `throw handleDatabaseError(err)`,
 * so the data layer threw bare strings. They carried no stack, and every downstream
 * `(err as Error).message` was undefined. The user-facing text is now carried on the
 * error as userMessage instead of being the thrown value.
 */
function handleDatabaseError(error: unknown): DatabaseError {
    const err = toError(error);
    const code = (error as { code?: string })?.code;
    const detail = (error as { detail?: string })?.detail;

    if (error instanceof PgDatabaseError) {
        const known: Record<string, string> = {
            '23505': 'Duplicate record found. Please try again.',
            '23503': 'Invalid reference. Please check your data.',
            '22001': 'Input value is too long. Please shorten the text.',
            '42601': 'An unexpected error occurred (Syntax error). Please try again later.',
            '42703': 'An unexpected error occurred (Undefined column). Please try again later.',
        };
        const userMessage = known[code ?? ''] ?? `An unexpected database error occurred (${code}). Please try again later.`;
        return new DatabaseError(`Database error ${code}${detail ? ': ' + detail : ''}`, {
            cause: err,
            userMessage,
            context: { code, detail },
        });
    }

    if (err.message === 'The server does not support SSL connections') {
        return new DatabaseError('Database rejected the SSL connection', {
            cause: err,
            isOperational: false,
            userMessage: 'SSL connection error. Please report this issue as it is a problem with the database settings.',
        });
    }
    if (err.message.includes('no pg_hba.conf entry for host')) {
        return new DatabaseError('Database refused the connection (pg_hba.conf)', {
            cause: err,
            isOperational: false,
            userMessage: 'Database connection error: Access denied. Please report this issue as it is a problem with the database settings.',
        });
    }
    if (err.message.includes('timeout exceeded when trying to connect')) {
        return new DatabaseError('Database connection timed out', {
            cause: err,
            userMessage: 'Database connection timed out.',
        });
    }

    return new DatabaseError('Unhandled database error', { cause: err, isOperational: false });
}

export default query;