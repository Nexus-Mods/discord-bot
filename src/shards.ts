import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrate.js';
import { logger } from './api/logger.js';
dotenv.config();

const manager = new ShardingManager('./dist/app.js', {
    token: process.env.DISCORD_TOKEN, // Bot token
    totalShards: process.env.NODE_ENV === 'testing' ? 2 : 'auto', // Automatically determine the number of shards
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
