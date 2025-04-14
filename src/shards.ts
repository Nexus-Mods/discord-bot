import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';
import * as dbMigrations from './api/migrations';
dotenv.config();

const manager = new ShardingManager('./dist/app.js', {
    token: process.env.DISCORD_TOKEN, // Bot token
    totalShards: process.env.NODE_ENV === 'testing' ? 2 : 'auto', // Automatically determine the number of shards
});

manager.on('shardCreate', (shard) => {
    console.log(`[Shard ${shard.id}] Launched shard ${shard.id + 1}/${manager.totalShards}`);
    shard.on('death', () => console.log(`[Shard ${shard.id}] Shard ${shard.id} died`, true));
    shard.on('disconnect', () => console.warn(`[Shard ${shard.id}] Shard ${shard.id} disconnected`));
    shard.on('reconnecting', () => console.log(`[Shard ${shard.id}] Shard ${shard.id} reconnecting`));
});

async function start() {
    // Run migrations
    const version = process.env.npm_package_version;
    try {
        if (version === '3.13.0') await dbMigrations.migrationDeleteAPIkeyColumn();
        if (version === '3.13.1') await dbMigrations.migrationMoveConfigOptionsToJSON();
    }
    catch(err) {
        console.error('Failed to run database migrations', err);
    }

    manager.spawn(); // Spawn the shards
}

start();
