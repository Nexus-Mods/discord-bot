import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrate.js';
import { logger } from './api/logger.js';
dotenv.config();

/**
 * The bot's only entry point. dist/app.js is the shard child and refuses to run on
 * its own, so there is one way to start the bot and it is the way production uses.
 *
 * The unsharded path used to exist for local development, which meant local runs
 * exercised `if (!client.shard)` branches that production never takes, and skipped the
 * ones it always takes. At 2,418 guilds - 82 short of the count at which Discord makes
 * sharding mandatory - "not sharded" is not a state this bot is ever in.
 *
 * BOT_SHARD_COUNT forces a specific number when one is wanted, which is the supported
 * way to run a single shard: `client.shard` is still populated with one, so the code
 * path is the same. It is not SHARD_COUNT - discord.js sets that itself in the children.
 */
function totalShards(): number | 'auto' {
    const configured = process.env.BOT_SHARD_COUNT;
    if (configured) {
        const count = Number(configured);
        if (!Number.isInteger(count) || count < 1) {
            logger.error('BOT_SHARD_COUNT must be a positive integer', { value: configured });
            process.exit(1);
        }
        return count;
    }
    return process.env.NODE_ENV === 'testing' ? 2 : 'auto';
}

const manager = new ShardingManager('./dist/app.js', {
    token: process.env.DISCORD_TOKEN, // Bot token
    totalShards: totalShards(),
});

manager.on('shardCreate', (shard) => {
    logger.info('Launched shard', { shard: shard.id, of: manager.totalShards });
    shard.on('death', () => logger.error('Shard died', { shard: shard.id }));
    shard.on('disconnect', () => logger.warn('Shard disconnected', { shard: shard.id }));
    shard.on('reconnecting', () => logger.info('Shard reconnecting', { shard: shard.id }));
});

async function start() {
    // Migrate before any shard exists. This used to be a pair of hand-written
    // migrations gated on npm_package_version, so they ran only if the version
    // string happened to match on that particular deploy and were skipped forever
    // otherwise. Failures were logged and swallowed, and the bot went on to start
    // against whatever schema it found.
    try {
        await runMigrations();
    }
    catch (err) {
        logger.error('Database migration failed, refusing to start', err);
        process.exit(1);
    }

    void manager.spawn(); // Spawn the shards
}

void start();
