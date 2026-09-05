// Loads .env by walking up from the code, not from the working directory.
import '@nexusmods/core/env.js';
import { logger } from '@nexusmods/core/logger.js';
import { runMigrations } from './db/migrate.js';
import { AuthSite } from './server/server.js';
import { createDiscordDirectory } from './server/discordDirectory.js';
import { closePools } from '@nexusmods/persistence/dbConnect.js';
import { assertTokenKeyConfigured } from '@nexusmods/persistence/tokenCrypto.js';

/**
 * Entry point for the auth site, which runs as its own container from the same image
 * as the bot. `dist/shards.js` is the bot; this is the web app.
 *
 * It migrates too. Both processes start from the same image, so they always carry the
 * same migration set, and runMigrations takes a Postgres advisory lock - four concurrent
 * runs were verified to serialise rather than race. Migrating here removes the ordering
 * dependency between the two containers: whichever starts first does the work, and the
 * other waits on the lock and finds nothing to do.
 */
async function start(): Promise<void> {
    try {
        assertTokenKeyConfigured();
    }
    catch (err) {
        logger.error('Token encryption is not configured, refusing to start', err);
        process.exit(1);
    }

    try {
        await runMigrations();
    }
    catch (err) {
        logger.error('Database migration failed, refusing to start', err);
        process.exit(1);
    }

    const token = process.env.DISCORD_TOKEN;
    if (!token) {
        logger.error('DISCORD_TOKEN is not set. The tracking page resolves guild and channel names with it, so the site cannot start.');
        process.exit(1);
    }

    const site = AuthSite.getInstance(createDiscordDirectory(token, logger), logger);

    // The container is stopped with SIGTERM. Without this the pool's connections are
    // dropped rather than closed, and on a 1 GB managed Postgres that allows 22
    // backends, connections that linger are the ones the bot needs.
    let shuttingDown = false;
    const shutdown = (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info('Shutting down auth site', { signal });
        void (async () => {
            try {
                await site.close();
                await closePools();
            }
            catch (err) {
                logger.warn('Error during shutdown', err);
            }
            process.exit(0);
        })();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
    logger.error('Fatal error starting the auth site', err);
    process.exit(1);
});
