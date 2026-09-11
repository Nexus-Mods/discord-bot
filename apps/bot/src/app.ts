// Loads .env by walking up from the code, not from the working directory.
import '@nexusmods/core/env.js';
import { DiscordBot } from './DiscordBot.js';
import { requireShard } from './lib/sharding.js';

const bot = DiscordBot.getInstance();
start().catch((err) => {
    bot.logger.error('Fatal error during startup', err);
    process.exit(1);
});

async function start() {
    // This file is the shard child, not an entry point. It used to be both, and the
    // standalone path is what let local runs take `if (!client.shard)` branches that
    // production never takes. ShardingManager sets SHARDING_MANAGER in its children;
    // without it, nothing has migrated the database or decided how many shards there
    // should be, so starting here would be a different program than the one that runs
    // in production.
    if (!process.env.SHARDING_MANAGER) {
        bot.logger.error(
            'dist/app.js is the shard process and cannot be started directly. Run `npm start` (dist/shards.js), which migrates the database and spawns the shards. To run a single shard, set BOT_SHARD_COUNT=1.',
        );
        process.exit(1);
    }

    const shardId = requireShard(bot.client).ids[0];
    bot.logger.info(`Starting shard ${shardId}`);

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
