// Loads .env by walking up from the code, not from the working directory.
import '@nexusmods/core/env.js';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { poolConfig } from '@nexusmods/persistence/dbConnect.js';
import { logger } from '@nexusmods/core/logger.js';
import { ConfigError, DatabaseError, toError } from '@nexusmods/core/errors.js';

// Entry point: `node dist/db/migrate.js` runs this without app.ts having loaded .env.

const { Pool } = pg;

/**
 * Advisory lock key held for the duration of the migration run.
 *
 * Under sharding the manager and every shard can reach this code, and in
 * production there may be more than one container. Without a lock they would all
 * see an empty __drizzle_migrations table at the same moment and all try to apply
 * the same migration. Postgres advisory locks are the right tool: they are held on
 * the session, released automatically if the process dies, and cost nothing when
 * uncontended. The value is arbitrary but must never change - a different key is a
 * different lock, which defeats the point.
 */
const MIGRATION_LOCK_KEY = '4017000001';

/**
 * Where the generated SQL lives.
 *
 * In the Docker image only dist/ is copied, so copy-assets puts the migrations at
 * dist/drizzle and this file sits at dist/db/migrate.js. Running from source (or
 * from a checkout) it is at <repo>/drizzle instead. Try both rather than guessing.
 */
function migrationsFolder(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        path.join(here, '..', 'drizzle'),
        path.join(here, '..', '..', 'drizzle'),
    ];
    const found = candidates.find((dir) => existsSync(path.join(dir, 'meta', '_journal.json')));
    if (!found) {
        throw new ConfigError('Could not find the drizzle migrations folder', {
            context: { candidates },
            userMessage: 'The bot is misconfigured and cannot start.',
        });
    }
    return found;
}

/**
 * Bring the database up to date, then return.
 *
 * Callers should treat a rejection as fatal. Starting the bot against a schema it
 * does not expect is worse than not starting: the failures surface later, as
 * confusing per-command errors, and some of them write bad data.
 */
export async function runMigrations(): Promise<void> {
    const folder = migrationsFolder();
    // A dedicated pool, separate from the app's. max: 2 because one connection
    // holds the advisory lock for the whole run while the migrator uses another.
    // query_timeout is deliberately cleared: the app wants stuck queries killed, but a
    // migration can legitimately take minutes and must not be aborted half way.
    const pool = new Pool({ ...poolConfig(), max: 2, idleTimeoutMillis: 0, query_timeout: undefined });
    let lockClient: pg.PoolClient | undefined;

    try {
        lockClient = await pool.connect();
        logger.info('Waiting for the migration lock');
        await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

        const started = Date.now();
        await migrate(drizzle(pool), { migrationsFolder: folder });
        logger.info('Database migrations complete', { ms: Date.now() - started });
    }
    catch (err) {
        throw new DatabaseError('Database migration failed', {
            cause: toError(err),
            isOperational: false,
            userMessage: 'The bot could not start because the database could not be migrated.',
        });
    }
    finally {
        if (lockClient) {
            // Best effort: the lock is released anyway when the session ends, which
            // the pool.end() below guarantees. Never let this mask the real error.
            await lockClient
                .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
                .catch((err) => logger.warn('Could not release the migration lock', err));
            lockClient.release();
        }
        await pool.end().catch((err) => logger.warn('Could not close the migration pool', err));
    }
}

// Allow `node dist/db/migrate.js` as a standalone step, for running migrations
// from CI or by hand without starting the bot.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    runMigrations()
        .then(() => process.exit(0))
        .catch((err) => {
            logger.error('Migration run failed', err);
            process.exit(1);
        });
}
