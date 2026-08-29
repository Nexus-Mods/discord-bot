import dotenv from 'dotenv';
dotenv.config();
import { DiscordBot } from './DiscordBot.js';
import { runMigrations } from './db/migrate.js';

const bot = DiscordBot.getInstance();
start().catch((err) => {
    bot.logger.error('Fatal error during startup', err);
    process.exit(1);
});

async function start() {
    // app.js is both the shard child process and the standalone entry point for
    // `npm start`. ShardingManager sets SHARDING_MANAGER in the children, and the
    // manager has already migrated by the time it spawns them, so only migrate
    // when this process was started on its own. The advisory lock inside
    // runMigrations makes a double run safe rather than merely unlikely.
    if (!process.env.SHARDING_MANAGER) {
        try {
            await runMigrations();
        }
        catch (err) {
            bot.logger.error('Database migration failed, refusing to start', err);
            process.exit(1);
        }
    }

    // Log the shard ID (if running in a shard)
    if (bot.client.shard) {
        const shardId = bot.client.shard.ids[0];
        bot.logger.info(`Starting shard ${shardId}`);
    }

    // Login with the Discord bot. 
    try {
        await bot.connect();
    }
    catch(err) {
        bot.logger.error('Failed to connect Discord bot', err);
        process.exit();
    }

    // Set up slash commands (if required)
    try {
        await bot.setupInteractions();
    }
    catch(err) {
        bot.logger.error('Failed to set up Discord bot interactions', err);
        process.exit();
    }
}

// The OAuth portal used to be started here and skipped on every shard but 0, so one
// of three gateway connections was also a web server. It is its own process now -
// dist/web.js - and shares nothing with this one but the database and the image.
