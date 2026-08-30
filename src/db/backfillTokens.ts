import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import pg from 'pg';
import { poolConfig } from '../api/dbConnect.js';
import { logger } from '../api/logger.js';
import { toError } from '../api/errors.js';
import { isSealed } from '../lib/sealedValue.js';
import { assertTokenKeyConfigured, needsSealing, openToken, sealToken } from './tokenCrypto.js';

// Entry point: `node dist/db/backfillTokens.js` runs without app.ts having loaded .env.
dotenv.config({ quiet: true });

const { Pool } = pg;

/**
 * One-shot conversion of the plaintext OAuth tokens in `users` to sealed values.
 *
 * **This is not a migration and not a background task.** It is an operator script, run
 * by hand, once, against a deployed 4.3.0.
 *
 * Not a drizzle migration, for three reasons. Migrations are plain SQL, and the
 * envelope is HKDF + AES-256-GCM in Node - reproducing it in SQL would mean handing the
 * key to the database session, where it lands in pg_stat_activity and possibly the
 * server log, which is the one place it must never be. Migrations also run at boot on
 * every container, behind a lock the other shards wait on, so 37,000 rows of crypto
 * would sit in the startup path. And the journal has no way to say "half applied,
 * resume from here", which is exactly the state a long conversion can end up in.
 *
 * Not a background task inside the bot, because it would run on every shard at once
 * unless guarded, nobody would be watching it, and a one-time rewrite of every
 * credential the service holds should be something a person starts and reads the output
 * of - not something that happens quietly during a deploy.
 *
 * **It is safe to run while the bot is live**, which is the point of doing it this way.
 * Two things make that true:
 *
 *   - Reads tolerate both states. `openToken` passes plaintext through untouched, so a
 *     row this script has not reached yet works exactly as before.
 *   - Writes are guarded. See `sealRow` - the UPDATE is conditional on the columns
 *     still holding what was read, so a token the bot refreshed mid-run is never
 *     overwritten with the older value.
 *
 * Safe to re-run: a sealed value fails `needsSealing` and is skipped, and the walk is
 * keyset-paginated, so a run that dies half way is resumed by running it again.
 */

/** The columns to convert, and the SQL to find candidates. Never interpolated from input. */
const TOKEN_COLUMNS = ['nexus_access', 'nexus_refresh', 'discord_access', 'discord_refresh'] as const;

// Row is keyed off TOKEN_COLUMNS rather than listing the four names again, so the two
// cannot drift: adding a column to the list is enough.
type Row = { d_id: string } & Record<(typeof TOKEN_COLUMNS)[number], string | null>;

/**
 * Held for the run so two operators cannot convert the same table at once.
 *
 * Deliberately a different key from the migration lock: this one is taken with
 * `pg_try_advisory_lock` and the script exits rather than queueing, because a second
 * operator who has just started a run wants to be told, not left waiting on a terminal
 * for twenty minutes.
 */
const BACKFILL_LOCK_KEY = '4017000002';

const DEFAULT_BATCH = 250;

interface Options {
    batch: number;
    from: string;
    dryRun: boolean;
    verifyOnly: boolean;
    report: boolean;
}

function options(): Options {
    const { values } = parseArgs({
        options: {
            batch: { type: 'string' },
            from: { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
            verify: { type: 'boolean', default: false },
            report: { type: 'boolean', default: false },
        },
    });
    const batch = values.batch ? Number(values.batch) : DEFAULT_BATCH;
    if (!Number.isInteger(batch) || batch <= 0 || batch > 5000) {
        throw new Error(`--batch must be an integer between 1 and 5000, got "${values.batch}"`);
    }
    return {
        batch,
        from: values.from ?? '',
        dryRun: values['dry-run'] ?? false,
        verifyOnly: values.verify ?? false,
        report: values.report ?? false,
    };
}

/**
 * Read-only census of what state the stored credentials are actually in.
 *
 * This exists because "expired" and "missing" look alike in a spreadsheet and are
 * nothing alike in consequence. An expired access token with a refresh token beside it
 * is the *normal* state for anyone who has not used the bot this week - it is repaired
 * silently on their next command. A missing refresh token cannot be repaired by
 * anything except the user linking again. Any decision about deleting rows has to be
 * made on the second number, and the second number is much smaller.
 *
 * The thresholds mirror DiscordBotUser's constructor rather than inventing their own,
 * because that constructor is what decides whether a row is usable: it requires
 * nexus_access, nexus_refresh **and** nexus_expires to all be truthy, and a row failing
 * that is already being treated as unlinked today - the throw is caught in users.ts and
 * turned into `undefined`. Note that `nexus_expires = 0` fails it too, which is why
 * this counts 0 as missing rather than as a very old timestamp.
 *
 * Discord is deliberately counted separately. A row with good Nexus tokens and no
 * Discord ones still works for everything except role claiming, so it is not a dead
 * row, and lumping the two together would overstate the damage several times over.
 */
async function report(client: pg.PoolClient): Promise<Record<string, number>> {
    const { rows } = await client.query<Record<string, string>>(`
        SELECT
            count(*)                                                              AS rows,
            count(*) FILTER (WHERE nexus_ok)                                      AS nexus_usable,
            count(*) FILTER (WHERE NOT nexus_ok)                                  AS nexus_unusable,
            count(*) FILTER (WHERE NOT nexus_ok AND nexus_blank AND discord_blank) AS entirely_blank,
            count(*) FILTER (WHERE NOT discord_ok)                                AS discord_unusable,
            count(*) FILTER (WHERE nexus_ok AND NOT discord_ok)                   AS nexus_only,
            count(*) FILTER (WHERE nexus_ok AND nexus_expires < $1)               AS expired_but_recoverable
        FROM (
            SELECT
                coalesce(nexus_access, '')   <> '' AND coalesce(nexus_refresh, '')   <> ''
                    AND coalesce(nexus_expires, 0) <> 0                       AS nexus_ok,
                coalesce(discord_access, '') <> '' AND coalesce(discord_refresh, '') <> '' AS discord_ok,
                coalesce(nexus_access, '')   =  '' AND coalesce(nexus_refresh, '')   =  '' AS nexus_blank,
                coalesce(discord_access, '') =  '' AND coalesce(discord_refresh, '') =  '' AS discord_blank,
                nexus_expires
            FROM users
        ) t`, [Date.now()]);

    // count() returns bigint, which pg hands back as a string to avoid losing precision.
    return Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]));
}

interface Totals {
    scanned: number;
    converted: number;
    columns: number;
    raced: number;
    skipped: number;
}

/**
 * Convert one row, or decide not to.
 *
 * The UPDATE carries every changed column twice: once as the new value, once in the
 * WHERE clause as the value that was read. That is the whole defence against the race
 * this script has with the running bot. Without it the sequence
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
 * 37,000 rows at once would tell the bot every profile is fresh when nothing was
 * fetched.
 */
async function sealRow(client: pg.PoolClient, row: Row, totals: Totals, dryRun: boolean, raced: string[]): Promise<void> {
    const sets: string[] = [];
    const guards: string[] = [];
    const values: unknown[] = [];

    for (const column of TOKEN_COLUMNS) {
        const plaintext = row[column];
        if (!needsSealing(plaintext)) continue;

        const sealed = sealToken(plaintext as string);

        // Verified per row, before anything is written. A seal that does not open is a
        // broken key or a broken envelope, and writing it would destroy the token
        // irrecoverably - there is no plaintext left to try again from. Aborting the
        // whole run on the first one is the only sane response.
        if (openToken(sealed) !== plaintext) {
            throw new Error(`Round-trip check failed for ${column} - refusing to write. The encryption key may be wrong.`);
        }

        values.push(sealed);
        sets.push(`${column} = $${values.length}`);
        // The guard value is pushed after the set value so the parameter numbers stay
        // in step with the order they are appended.
        values.push(plaintext);
        guards.push(`${column} IS NOT DISTINCT FROM $${values.length}`);
    }

    if (sets.length === 0) {
        totals.skipped += 1;
        return;
    }

    if (dryRun) {
        totals.converted += 1;
        totals.columns += sets.length;
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
        totals.raced += 1;
        raced.push(row.d_id);
        return;
    }
    totals.converted += 1;
    totals.columns += sets.length;
}

/**
 * Walk the table in `d_id` order, sealing as it goes.
 *
 * Keyset pagination rather than OFFSET, and rather than repeatedly selecting "the next
 * N rows that still need work". The latter reads better but can spin forever: a row
 * that keeps losing the race above would be selected, skipped, and selected again. A
 * cursor that only ever moves forward terminates whatever happens to any individual
 * row, and makes `--from` a meaningful way to resume.
 */
async function walk(client: pg.PoolClient, opts: Options, totals: Totals, raced: string[]): Promise<void> {
    let cursor = opts.from;
    let batches = 0;

    for (;;) {
        const { rows } = await client.query<Row>(
            `SELECT d_id, ${TOKEN_COLUMNS.join(', ')} FROM users WHERE d_id > $1 ORDER BY d_id LIMIT $2`,
            [cursor, opts.batch],
        );
        if (rows.length === 0) break;

        for (const row of rows) {
            await sealRow(client, row, totals, opts.dryRun, raced);
            totals.scanned += 1;
        }

        cursor = rows[rows.length - 1].d_id;
        batches += 1;
        if (batches % 10 === 0 || rows.length < opts.batch) {
            logger.info('Backfill progress', { scanned: totals.scanned, converted: totals.converted, cursor });
        }
    }
}

/** Rounds of re-reading raced rows before giving up and telling the operator to re-run. */
const MAX_RETRY_ROUNDS = 3;

/**
 * Re-read and re-seal the rows that lost the race during the walk.
 *
 * Without this a single run cannot finish on a busy database. The guard covers the
 * whole row, so one token refresh mid-walk leaves that row's other three columns
 * plaintext - and against production, with 37,000 rows and a live bot, that is not an
 * edge case but the normal outcome. Re-reading picks up whatever the bot wrote and
 * seals what is still bare.
 *
 * Bounded rather than looping until clean: a row being written to continuously would
 * spin here forever, and the honest answer to that is to stop and let a person decide,
 * not to hold the connection open. Anything still unsealed is reported and the exit
 * code says re-run.
 */
async function retryRaced(client: pg.PoolClient, opts: Options, totals: Totals, first: string[]): Promise<void> {
    let pending = first;

    for (let round = 1; round <= MAX_RETRY_ROUNDS && pending.length > 0; round++) {
        logger.info('Re-reading rows that were written during the walk', { round, rows: pending.length });
        const next: string[] = [];

        for (let i = 0; i < pending.length; i += opts.batch) {
            const ids = pending.slice(i, i + opts.batch);
            const { rows } = await client.query<Row>(
                `SELECT d_id, ${TOKEN_COLUMNS.join(', ')} FROM users WHERE d_id = ANY($1)`,
                [ids],
            );
            for (const row of rows) await sealRow(client, row, totals, opts.dryRun, next);
        }

        // These rows were counted as raced on the way in; only the ones still losing
        // the race at the end of the run should be reported as such.
        totals.raced -= pending.length - next.length;
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
 * letting the run report success because it reached the end of the table.
 */
async function census(client: pg.PoolClient, batch: number): Promise<{ rows: number; plaintext: number; sealed: number; empty: number }> {
    const out = { rows: 0, plaintext: 0, sealed: 0, empty: 0 };
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
                else if (isSealed(value)) out.sealed += 1;
                else out.plaintext += 1;
            }
        }
        cursor = rows[rows.length - 1].d_id;
    }
    return out;
}

export async function backfillTokens(): Promise<number> {
    const opts = options();

    // Before a single row is read. A missing or unusable key must stop the run here,
    // not after 10,000 rows.
    assertTokenKeyConfigured();

    // query_timeout cleared for the same reason as the migration pool: the app wants
    // stuck queries killed, a maintenance walk must not be cut off part way.
    const pool = new Pool({ ...poolConfig(), max: 2, idleTimeoutMillis: 0, query_timeout: undefined });
    let client: pg.PoolClient | undefined;
    const totals: Totals = { scanned: 0, converted: 0, columns: 0, raced: 0, skipped: 0 };

    try {
        client = await pool.connect();

        const lock = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [BACKFILL_LOCK_KEY]);
        if (!lock.rows[0]?.locked) {
            logger.error('Another token backfill is already running. Not starting a second one.');
            return 1;
        }

        if (opts.report) {
            const state = await report(client);
            logger.info('Credential state', state);
            logger.info('expired_but_recoverable rows are healthy: they hold a refresh token and repair themselves on next use. Only nexus_unusable rows cannot be recovered without the user linking again.');
            return 0;
        }

        if (opts.verifyOnly) {
            const state = await census(client, opts.batch);
            logger.info('Token census', state);
            return state.plaintext === 0 ? 0 : 1;
        }

        const before = await census(client, opts.batch);
        logger.info('Starting token backfill', {
            mode: opts.dryRun ? 'dry-run' : 'write',
            batch: opts.batch,
            from: opts.from || '(start)',
            plaintextValues: before.plaintext,
            sealedValues: before.sealed,
        });

        const started = Date.now();
        const raced: string[] = [];
        await walk(client, opts, totals, raced);
        if (raced.length > 0 && !opts.dryRun) await retryRaced(client, opts, totals, raced);

        const after = await census(client, opts.batch);
        logger.info('Token backfill complete', {
            ...totals,
            ms: Date.now() - started,
            plaintextRemaining: after.plaintext,
            sealedValues: after.sealed,
        });

        if (opts.dryRun) {
            logger.info('Dry run - nothing was written. Re-run without --dry-run to apply.');
            return 0;
        }
        if (after.plaintext > 0) {
            logger.warn('Some values are still plaintext. Re-run to pick them up; if the count does not fall, investigate before continuing.', {
                plaintextRemaining: after.plaintext,
            });
            return 1;
        }

        // The step that actually removes the plaintext, and the one most likely to be
        // forgotten. UPDATE writes a new row version and leaves the old one, plaintext
        // and all, in the heap until it is rewritten - so until this runs, the thing
        // being protected against (a dump, a backup, a restored snapshot) still
        // contains every token in the clear.
        logger.info('Every token is sealed. The plaintext is still in the heap as dead tuples - run VACUUM FULL users (or pg_repack) to remove it, then take a fresh backup.');
        return 0;
    }
    catch (err) {
        logger.error('Token backfill failed', toError(err), { progress: totals });
        return 1;
    }
    finally {
        if (client) {
            await client
                .query('SELECT pg_advisory_unlock($1)', [BACKFILL_LOCK_KEY])
                .catch((err) => logger.warn('Could not release the backfill lock', err));
            client.release();
        }
        await pool.end().catch((err) => logger.warn('Could not close the backfill pool', err));
    }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    backfillTokens()
        .then((code) => process.exit(code))
        .catch((err) => {
            logger.error('Token backfill failed', err);
            process.exit(1);
        });
}
