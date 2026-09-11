// Loads .env by walking up from the code, not from the working directory.
import '@nexusmods/core/env.js';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { poolConfig } from '@nexusmods/persistence/dbConnect.js';
import { logger } from '@nexusmods/core/logger.js';
import { toError } from '@nexusmods/core/errors.js';
import { isSealed } from '@nexusmods/core/sealedValue.js';
import { assertTokenKeyConfigured, needsResealing, needsSealing, openToken, resealToken, sealToken } from '@nexusmods/persistence/tokenCrypto.js';

// Entry point: `node dist/db/backfillTokens.js` runs without app.ts having loaded .env.
// Harmless when this module is imported by the bot, which has loaded it already.

const { Pool } = pg;

/**
 * Maintenance for the sealed OAuth token columns in `users`.
 *
 * Two jobs remain now the original migration is done: rotation (re-sealing every value
 * from an old key onto the current one, keyed on `needsResealing` - `needsSealing` is
 * false for an already-sealed value and silently skips everything), and recovery, since
 * `openToken` refuses an unsealed value.
 *
 * Safe to run while the bot is live: the UPDATE in `sealRow` is conditional on the columns
 * still holding what was read. Safe to re-run: already-sealed values are skipped and the
 * walk is keyset-paginated.
 *
 * The key comes from the bot's own environment. Sealing succeeds with ANY valid key, so a
 * run against the wrong one would quietly make every row it touched unreadable.
 */

/** The columns to convert. Never interpolated from input. */
const TOKEN_COLUMNS = ['nexus_access', 'nexus_refresh', 'discord_access', 'discord_refresh'] as const;

type Row = { d_id: string } & Record<(typeof TOKEN_COLUMNS)[number], string | null>;

/**
 * Stops two runs converting the same table at once - the droplet and `/tokens backfill`
 * are different processes. A different key from the migration lock, and taken with
 * `pg_try_advisory_lock` so a second run is told rather than queued.
 */
const BACKFILL_LOCK_KEY = '4017000002';

const DEFAULT_BATCH = 250;

/** Rounds of re-reading raced rows before giving up and asking for a re-run. */
const MAX_RETRY_ROUNDS = 3;

interface BackfillOptions {
    batch?: number;
    from?: string;
    dryRun?: boolean;
}

interface BackfillProgress {
    phase: 'starting' | 'counting' | 'walking' | 'retrying' | 'verifying' | 'done' | 'failed';
    dryRun: boolean;
    /** Total rows in the table, known once the initial count is done. */
    total?: number;
    scanned: number;
    converted: number;
    columns: number;
    raced: number;
    skipped: number;
    /** Columns moved from an old key onto the current one. Non-zero only during a rotation. */
    resealedColumns: number;
    /** Columns sealed under a key no longer configured. These cannot be repaired. */
    unopenable: number;
    plaintextBefore?: number;
    plaintextRemaining?: number;
    /** Values still sealed under an old key once the run finished. Must be 0 before removing the old key. */
    staleKeyRemaining?: number;
    startedAt: number;
    finishedAt?: number;
    error?: string;
}

type ProgressListener = (progress: Readonly<BackfillProgress>) => void;

interface Census {
    rows: number;
    plaintext: number;
    sealed: number;
    empty: number;
    /**
     * Sealed, but not under the current key. Zero except mid-rotation - and the number
     * that must reach zero before TOKEN_ENCRYPTION_KEY_OLD is removed, because every one
     * of these becomes unreadable the moment it is.
     */
    staleKey: number;
}

/**
 * A short-lived pool of its own rather than the application's.
 *
 * Two connections, no query timeout: the app wants stuck queries killed after fifteen
 * seconds, and a maintenance walk must not be cut off part way through. Keeping it
 * separate also means running this from inside the bot borrows two connections for the
 * duration instead of competing for the four the shard is using to serve commands.
 */
async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const pool = new Pool({ ...poolConfig(), max: 2, idleTimeoutMillis: 0, query_timeout: undefined });
    let client: pg.PoolClient | undefined;
    try {
        client = await pool.connect();
        return await fn(client);
    }
    finally {
        client?.release();
        await pool.end().catch((err) => logger.warn('Could not close the maintenance pool', err));
    }
}

/**
 * Convert one row, or decide not to.
 *
 * The UPDATE carries every changed column twice - as the new value, and in the WHERE as
 * the value that was read. Without that, a token the bot refreshed mid-run would be rolled
 * back to the sealed form of the revoked one. A mismatch updates zero rows instead.
 *
 * `IS NOT DISTINCT FROM`, not `=`: these columns are nullable and `NULL = NULL` is NULL.
 * `lastupdate` is deliberately untouched - it records profile freshness, not this.
 */
async function sealRow(client: pg.PoolClient, row: Row, p: BackfillProgress, dryRun: boolean, raced: string[]): Promise<void> {
    const sets: string[] = [];
    const guards: string[] = [];
    const values: unknown[] = [];

    for (const column of TOKEN_COLUMNS) {
        const stored = row[column];

        // Two jobs, one walk. Sealing turns plaintext into ciphertext, which is what the
        // original migration did; re-sealing moves ciphertext from an old key onto the
        // current one, which is what a key rotation needs. They differ only in where the
        // plaintext comes from, and both must survive the same round-trip check.
        let expected: string;
        let replacement: string;

        if (needsSealing(stored)) {
            expected = stored as string;
            replacement = sealToken(expected);
        }
        else if (needsResealing(stored)) {
            const opened = resealToken(stored as string);
            // Opens under no configured key: the plaintext is gone and nothing here can
            // bring it back. Leave the row exactly as it is - writing something derived
            // from a failed decrypt would turn one unreadable user into a corrupted one.
            if (opened === null) {
                p.unopenable += 1;
                continue;
            }
            expected = openToken(stored as string, column) as string;
            replacement = opened;
            p.resealedColumns += 1;
        }
        else continue;

        // Verified per row, before anything is written. A seal that does not open is a
        // broken key or a broken envelope, and writing it would destroy the token
        // irrecoverably - there is no plaintext left to try again from. Aborting the
        // whole run on the first one is the only safe response.
        if (openToken(replacement, column) !== expected) {
            throw new Error(`Round-trip check failed for ${column} - refusing to write. The encryption key may be wrong.`);
        }

        values.push(replacement);
        sets.push(`${column} = $${values.length}`);
        // Pushed after the set value so the parameter numbers stay in step with the
        // order they are appended. The guard is the value as it was read, whether that
        // was plaintext or ciphertext under the old key.
        values.push(stored);
        guards.push(`${column} IS NOT DISTINCT FROM $${values.length}`);
    }

    if (sets.length === 0) {
        p.skipped += 1;
        return;
    }

    if (dryRun) {
        p.converted += 1;
        p.columns += sets.length;
        return;
    }

    values.push(row.d_id);
    const text = `UPDATE users SET ${sets.join(', ')} WHERE d_id = $${values.length} AND ${guards.join(' AND ')}`;
    const result = await client.query(text, values);

    if (result.rowCount === 0) {
        // The bot wrote to this row mid-read. The guard covers all four columns at once,
        // so one refresh blocks the other three too - revisit after the walk.
        p.raced += 1;
        raced.push(row.d_id);
        return;
    }
    p.converted += 1;
    p.columns += sets.length;
}

/**
 * Walk the table in `d_id` order. Keyset pagination, not OFFSET or "next N rows still
 * needing work" - the latter can spin forever on a row that keeps losing the race above.
 */
async function walk(
    client: pg.PoolClient,
    batch: number,
    from: string,
    dryRun: boolean,
    p: BackfillProgress,
    raced: string[],
    emit: () => void,
): Promise<void> {
    let cursor = from;
    let batches = 0;

    for (;;) {
        const { rows } = await client.query<Row>(
            `SELECT d_id, ${TOKEN_COLUMNS.join(', ')} FROM users WHERE d_id > $1 ORDER BY d_id LIMIT $2`,
            [cursor, batch],
        );
        if (rows.length === 0) break;

        for (const row of rows) {
            await sealRow(client, row, p, dryRun, raced);
            p.scanned += 1;
        }

        cursor = rows[rows.length - 1].d_id;
        batches += 1;
        emit();
        if (batches % 10 === 0 || rows.length < batch) {
            logger.info('Backfill progress', { scanned: p.scanned, converted: p.converted, cursor });
        }
    }
}

/**
 * Re-read rows the bot wrote during the walk. The guard covers the whole row, so one token
 * refresh leaves that row's other three columns plaintext - against production that is the
 * normal outcome, not an edge case.
 *
 * Bounded rather than looping until clean: a continuously-written row would spin forever.
 * Anything still unsealed is reported and the caller re-runs.
 */
async function retryRaced(
    client: pg.PoolClient,
    batch: number,
    dryRun: boolean,
    p: BackfillProgress,
    first: string[],
    emit: () => void,
): Promise<void> {
    let pending = first;

    for (let round = 1; round <= MAX_RETRY_ROUNDS && pending.length > 0; round++) {
        logger.info('Re-reading rows that were written during the walk', { round, rows: pending.length });
        const next: string[] = [];

        for (let i = 0; i < pending.length; i += batch) {
            const ids = pending.slice(i, i + batch);
            const { rows } = await client.query<Row>(
                `SELECT d_id, ${TOKEN_COLUMNS.join(', ')} FROM users WHERE d_id = ANY($1)`,
                [ids],
            );
            for (const row of rows) await sealRow(client, row, p, dryRun, next);
            emit();
        }

        // These rows were counted as raced on the way in; only the ones still losing
        // the race at the end of the run should be reported as such.
        p.raced -= pending.length - next.length;
        pending = next;
    }

    if (pending.length > 0) {
        logger.warn('Some rows were written to on every attempt and were left alone', { rows: pending.length });
    }
}

/**
 * Count what is left, using the same check the application uses.
 *
 * Not a SQL `NOT LIKE 'v1.%'`: the authority on whether a value is sealed is
 * `isSealed`, and a census that disagreed with the code would be worse than none. This
 * is also what catches a value the walk could not convert for any reason, rather than
 * letting a run report success because it reached the end of the table.
 */
async function censusWith(client: pg.PoolClient, batch: number): Promise<Census> {
    const out: Census = { rows: 0, plaintext: 0, sealed: 0, empty: 0, staleKey: 0 };
    let cursor = '';

    for (;;) {
        const { rows } = await client.query<Row>(
            `SELECT d_id, ${TOKEN_COLUMNS.join(', ')} FROM users WHERE d_id > $1 ORDER BY d_id LIMIT $2`,
            [cursor, batch],
        );
        if (rows.length === 0) break;

        for (const row of rows) {
            out.rows += 1;
            for (const column of TOKEN_COLUMNS) {
                const value = row[column];
                if (value === null || value === '') out.empty += 1;
                else if (isSealed(value)) {
                    out.sealed += 1;
                    if (needsResealing(value)) out.staleKey += 1;
                }
                else out.plaintext += 1;
            }
        }
        cursor = rows[rows.length - 1].d_id;
    }
    return out;
}

/** How many token values are sealed, plaintext, or absent. */
async function tokenCensus(batch = DEFAULT_BATCH): Promise<Census> {
    assertTokenKeyConfigured();
    return withClient((client) => censusWith(client, batch));
}

/**
 * Read-only census of credential state. "Expired" and "missing" look alike in a count and
 * are nothing alike: an expired access token beside a refresh token repairs itself on the
 * user's next command, a missing refresh token needs them to link again.
 *
 * Thresholds mirror DiscordBotUser's constructor, which requires nexus_access,
 * nexus_refresh AND nexus_expires to be truthy - so `nexus_expires = 0` counts as missing.
 * Discord is counted separately.
 */
async function credentialReport(): Promise<Record<string, number>> {
    return withClient(async (client) => {
        const { rows } = await client.query<Record<string, string>>(`
            SELECT
                count(*)                                                               AS rows,
                count(*) FILTER (WHERE nexus_ok)                                       AS nexus_usable,
                count(*) FILTER (WHERE NOT nexus_ok)                                   AS nexus_unusable,
                count(*) FILTER (WHERE NOT nexus_ok AND nexus_blank AND discord_blank) AS entirely_blank,
                count(*) FILTER (WHERE NOT discord_ok)                                 AS discord_unusable,
                count(*) FILTER (WHERE nexus_ok AND NOT discord_ok)                    AS nexus_only,
                count(*) FILTER (WHERE nexus_ok AND nexus_expires < $1)                AS expired_but_recoverable
            FROM (
                SELECT
                    coalesce(nexus_access, '')   <> '' AND coalesce(nexus_refresh, '')   <> ''
                        AND coalesce(nexus_expires, 0) <> 0                        AS nexus_ok,
                    coalesce(discord_access, '') <> '' AND coalesce(discord_refresh, '') <> '' AS discord_ok,
                    coalesce(nexus_access, '')   =  '' AND coalesce(nexus_refresh, '')   =  '' AS nexus_blank,
                    coalesce(discord_access, '') =  '' AND coalesce(discord_refresh, '') =  '' AS discord_blank,
                    nexus_expires
                FROM users
            ) t`, [Date.now()]);

        // count() returns bigint, which pg hands back as a string to keep precision.
        return Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]));
    });
}

/** Raised when another process already holds the backfill lock. */
class BackfillAlreadyRunningError extends Error {
    constructor() {
        super('Another token backfill is already running.');
        this.name = 'BackfillAlreadyRunningError';
    }
}

/**
 * Convert every plaintext token in the table.
 *
 * `onProgress` is called as the run advances so a caller can show it - the `/tokens`
 * command edits a Discord reply from it. It is called often; the listener should be
 * cheap and must not throw.
 */
async function runBackfill(options: BackfillOptions = {}, onProgress?: ProgressListener): Promise<BackfillProgress> {
    const batch = options.batch ?? DEFAULT_BATCH;
    if (!Number.isInteger(batch) || batch <= 0 || batch > 5000) {
        throw new Error(`batch must be an integer between 1 and 5000, got "${batch}"`);
    }
    const from = options.from ?? '';
    const dryRun = options.dryRun ?? false;

    // Before a single row is read. A missing or unusable key must stop the run here,
    // not after ten thousand rows.
    assertTokenKeyConfigured();

    const p: BackfillProgress = {
        phase: 'starting', dryRun, scanned: 0, converted: 0, columns: 0,
        raced: 0, skipped: 0, resealedColumns: 0, unopenable: 0, startedAt: Date.now(),
    };
    const emit = () => { try { onProgress?.(p); } catch { /* a broken listener must not fail the run */ } };

    // Progress is mutated through these rather than inline. `p` has exactly one writer
    // - this function, sequentially - but assigning to its properties either side of an
    // await trips require-atomic-updates, and a rule that is disabled six times stops
    // being read. Going through a synchronous helper also means a phase change and the
    // notification that goes with it cannot drift apart.
    const setPhase = (next: BackfillProgress['phase']) => { p.phase = next; emit(); };
    const finish = (plaintextRemaining: number, staleKeyRemaining: number) => {
        p.plaintextRemaining = plaintextRemaining;
        p.staleKeyRemaining = staleKeyRemaining;
        p.finishedAt = Date.now();
        setPhase('done');
    };
    const fail = (err: unknown) => {
        p.error = toError(err).message;
        p.finishedAt = Date.now();
        setPhase('failed');
    };
    emit();

    try {
        return await withClient(async (client) => {
            const lock = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [BACKFILL_LOCK_KEY]);
            if (!lock.rows[0]?.locked) throw new BackfillAlreadyRunningError();

            try {
                setPhase('counting');
                const before = await censusWith(client, batch);
                Object.assign(p, { total: before.rows, plaintextBefore: before.plaintext });
                logger.info('Starting token backfill', {
                    mode: dryRun ? 'dry-run' : 'write', batch, from: from || '(start)',
                    plaintextValues: before.plaintext, sealedValues: before.sealed,
                });

                setPhase('walking');
                const raced: string[] = [];
                await walk(client, batch, from, dryRun, p, raced, emit);

                if (raced.length > 0 && !dryRun) {
                    setPhase('retrying');
                    await retryRaced(client, batch, dryRun, p, raced, emit);
                }

                setPhase('verifying');
                const after = await censusWith(client, batch);
                finish(after.plaintext, after.staleKey);

                logger.info('Token backfill complete', {
                    scanned: p.scanned, converted: p.converted, columns: p.columns,
                    raced: p.raced, skipped: p.skipped, resealed: p.resealedColumns,
                    unopenable: p.unopenable, ms: (p.finishedAt ?? Date.now()) - p.startedAt,
                    plaintextRemaining: after.plaintext, staleKeyRemaining: after.staleKey,
                    sealedValues: after.sealed,
                });

                if (p.unopenable > 0) {
                    logger.warn('Some values open under no configured key and were left untouched. They are unreadable and those users must link again.', {
                        values: p.unopenable,
                    });
                }

                if (!dryRun && after.staleKey > 0) {
                    logger.warn('Values are still sealed under the old key. Do NOT remove TOKEN_ENCRYPTION_KEY_OLD yet - every one of these becomes unreadable the moment you do.', {
                        staleKeyRemaining: after.staleKey,
                    });
                }
                else if (!dryRun && after.plaintext === 0) {
                    // The step that actually removes the plaintext, and the one most
                    // likely to be forgotten. UPDATE writes a new row version and leaves
                    // the old one, plaintext and all, in the heap until it is rewritten -
                    // so until this runs, the thing being protected against (a dump, a
                    // backup, a restored snapshot) still contains every token in clear.
                    logger.info('Every token is sealed. The plaintext is still in the heap as dead tuples - run VACUUM FULL users (or pg_repack) to remove it, then take a fresh backup.');
                }
                return p;
            }
            finally {
                await client
                    .query('SELECT pg_advisory_unlock($1)', [BACKFILL_LOCK_KEY])
                    .catch((err) => logger.warn('Could not release the backfill lock', err));
            }
        });
    }
    catch (err) {
        fail(err);
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Command line wrapper. Everything above is what `/tokens` calls.
// ---------------------------------------------------------------------------

function cliOptions() {
    const { values } = parseArgs({
        options: {
            batch: { type: 'string' },
            from: { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
            verify: { type: 'boolean', default: false },
            report: { type: 'boolean', default: false },
        },
    });
    return {
        batch: values.batch ? Number(values.batch) : DEFAULT_BATCH,
        from: values.from ?? '',
        dryRun: values['dry-run'] ?? false,
        verifyOnly: values.verify ?? false,
        report: values.report ?? false,
    };
}

async function main(): Promise<number> {
    const opts = cliOptions();
    try {
        if (opts.report) {
            logger.info('Credential state', await credentialReport());
            logger.info('expired_but_recoverable rows are healthy: they hold a refresh token and repair themselves on next use. Only nexus_unusable rows cannot be recovered without the user linking again.');
            return 0;
        }

        if (opts.verifyOnly) {
            const state = await tokenCensus(opts.batch);
            logger.info('Token census', state);
            return state.plaintext === 0 && state.staleKey === 0 ? 0 : 1;
        }

        const result = await runBackfill({ batch: opts.batch, from: opts.from, dryRun: opts.dryRun });

        if (opts.dryRun) {
            logger.info('Dry run - nothing was written. Re-run without --dry-run to apply.');
            return 0;
        }
        if ((result.staleKeyRemaining ?? 0) > 0) {
            logger.warn('Rotation incomplete - re-run before removing TOKEN_ENCRYPTION_KEY_OLD.', {
                staleKeyRemaining: result.staleKeyRemaining,
            });
            return 1;
        }
        if ((result.plaintextRemaining ?? 0) > 0) {
            logger.warn('Some values are still plaintext. Re-run to pick them up; if the count does not fall, investigate before continuing.', {
                plaintextRemaining: result.plaintextRemaining,
            });
            return 1;
        }
        return 0;
    }
    catch (err) {
        logger.error('Token maintenance failed', toError(err));
        return 1;
    }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main()
        .then((code) => process.exit(code))
        .catch((err) => {
            logger.error('Token maintenance failed', err);
            process.exit(1);
        });
}
