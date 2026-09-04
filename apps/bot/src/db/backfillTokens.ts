import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import pg from 'pg';
import { poolConfig } from '../api/dbConnect.js';
import { logger } from '../api/logger.js';
import { toError } from '../api/errors.js';
import { isSealed } from '../lib/sealedValue.js';
import { assertTokenKeyConfigured, needsResealing, needsSealing, openToken, resealToken, sealToken } from './tokenCrypto.js';

// Entry point: `node dist/db/backfillTokens.js` runs without app.ts having loaded .env.
// Harmless when this module is imported by the bot, which has loaded it already.
dotenv.config({ quiet: true });

const { Pool } = pg;

/**
 * Maintenance for the sealed OAuth token columns in `users`.
 *
 * It began as a one-shot migration - convert ~147,000 plaintext values to ciphertext -
 * and that job is done. It is kept because it does two things that still matter:
 *
 *   - **Rotation.** Moving every value from an old key onto the current one is the
 *     second half of a key rotation, and there is no other way to do it. See
 *     `needsResealing`: the original version tested `needsSealing`, which is false for
 *     an already-sealed value, so a rotation run skipped every row and reported success.
 *     Removing TOKEN_ENCRYPTION_KEY_OLD after that made every row unreadable at once.
 *   - **Recovery.** `openToken` now refuses an unsealed value rather than passing it
 *     through, so if anything ever writes a token without sealing it, those users are
 *     locked out until this runs.
 *
 * **It is safe to run while the bot is live**, which is the point of doing it this way
 * rather than in a maintenance window. Writes are guarded: see `sealRow` - the UPDATE is
 * conditional on the columns still holding what was read, so a token the bot refreshed
 * mid-run is never overwritten with the older value.
 *
 * Safe to re-run: a value already sealed under the current key matches neither
 * `needsSealing` nor `needsResealing` and is skipped, and the walk is keyset-paginated,
 * so a run that dies half way is resumed by running it again.
 *
 * The key comes from the same environment the bot is using. That matters more than it
 * looks: sealing succeeds with *any* valid key, so a run against the wrong one would not
 * fail, it would quietly make every row it touched unreadable by the bot.
 */

/** The columns to convert. Never interpolated from input. */
const TOKEN_COLUMNS = ['nexus_access', 'nexus_refresh', 'discord_access', 'discord_refresh'] as const;

// Keyed off TOKEN_COLUMNS rather than listing the four names again, so the two cannot
// drift: adding a column to the list is enough.
type Row = { d_id: string } & Record<(typeof TOKEN_COLUMNS)[number], string | null>;

/**
 * Held for the run so two operators cannot convert the same table at once - including
 * an operator on the droplet and someone running `/tokens backfill` at the same moment,
 * which are different processes and cannot see each other any other way.
 *
 * Deliberately a different key from the migration lock, and taken with
 * `pg_try_advisory_lock` so a second run is told rather than left queueing.
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
 * The UPDATE carries every changed column twice: once as the new value, once in the
 * WHERE clause as the value that was read. That is the whole defence against the race
 * with the running bot. Without it the sequence
 *
 *   1. backfill reads the plaintext token
 *   2. bot refreshes it and writes a new, sealed one
 *   3. backfill writes the sealed form of the *old* token
 *
 * silently rolls a live credential back to a revoked one, for precisely the users who
 * were active during the run. With it, step 3 matches nothing, updates zero rows, and
 * the row is left as the bot wrote it - already sealed, so there is nothing left to do.
 *
 * `IS NOT DISTINCT FROM` rather than `=` because these columns are nullable and
 * `NULL = NULL` is NULL, which would make the guard fail on every row holding a null.
 *
 * `lastupdate` is deliberately not touched. It records when a user's profile was
 * refreshed from the APIs, and the bot reads it to decide what is stale; bumping it for
 * every row at once would claim every profile is fresh when nothing was fetched.
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
        // The bot wrote to this row between the read and the write. Nothing here is
        // wrong - the row holds what the bot wrote - but the guard covers all four
        // columns at once, so a refresh of one token also stopped the other three from
        // being sealed. Collect the row for a second look once the walk is done.
        p.raced += 1;
        raced.push(row.d_id);
        return;
    }
    p.converted += 1;
    p.columns += sets.length;
}

/**
 * Walk the table in `d_id` order, sealing as it goes.
 *
 * Keyset pagination rather than OFFSET, and rather than repeatedly selecting "the next
 * N rows that still need work". The latter reads better but can spin forever: a row
 * that keeps losing the race above would be selected, skipped, and selected again. A
 * cursor that only ever moves forward terminates whatever happens to any individual
 * row, and makes `from` a meaningful way to resume.
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
 * Re-read and re-seal the rows that lost the race during the walk.
 *
 * Without this a single run cannot finish on a busy database. The guard covers the
 * whole row, so one token refresh mid-walk leaves that row's other three columns
 * plaintext - and against production, with tens of thousands of rows and a live bot,
 * that is not an edge case but the normal outcome. Re-reading picks up whatever the bot
 * wrote and seals what is still bare.
 *
 * Bounded rather than looping until clean: a row being written to continuously would
 * spin here forever, and the honest answer to that is to stop and let a person decide.
 * Anything still unsealed is reported and the caller is told to re-run.
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
 * Read-only census of what state the stored credentials are actually in.
 *
 * This exists because "expired" and "missing" look alike in a count and are nothing
 * alike in consequence. An expired access token with a refresh token beside it is the
 * *normal* state for anyone who has not used the bot this month - it is repaired
 * silently on their next command. A missing refresh token cannot be repaired by
 * anything except the user linking again. Any decision about deleting rows has to be
 * made on the second number, and the second number is much smaller.
 *
 * The thresholds mirror DiscordBotUser's constructor rather than inventing their own,
 * because that constructor is what decides whether a row is usable: it requires
 * nexus_access, nexus_refresh **and** nexus_expires to all be truthy, and a row failing
 * that is already treated as unlinked today - the throw is caught in users.ts and
 * turned into `undefined`. Note that `nexus_expires = 0` fails it too, which is why
 * this counts 0 as missing rather than as a very old timestamp.
 *
 * Discord is counted separately. A row with good Nexus tokens and no Discord ones still
 * works for everything except role claiming, so it is not a dead row, and lumping the
 * two together would overstate the damage several times over.
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
