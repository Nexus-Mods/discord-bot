import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';
import * as dbMigrations from './api/migrations.js';
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
    // Run migrations
    const version = process.env.npm_package_version;
    try {
        if (version === '3.13.0') await dbMigrations.migrationDeleteAPIkeyColumn();
        if (version === '3.13.1') await dbMigrations.migrationMoveConfigOptionsToJSON();
    }
    catch(err) {
        logger.error('Failed to run database migrations', err);
    }

    void manager.spawn(); // Spawn the shards
}

void start();
