import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const manager = new ShardingManager('./dist/app.js', {
    token: process.env.DISCORD_TOKEN, // Bot token
    totalShards: process.env.NODE_ENV === 'test' ? 2 : 'auto', // Automatically determine the number of shards
});

manager.on('shardCreate', (shard) => {
    console.log(`[Shard ${shard.id}] Launched shard`);
    shard.on('death', () => console.log(`[Shard ${shard.id}] Shard ${shard.id} died`, true));
    shard.on('disconnect', () => console.warn(`[Shard ${shard.id}] Shard ${shard.id} disconnected`));
    shard.on('reconnecting', () => console.log(`[Shard ${shard.id}] Shard ${shard.id} reconnecting`));
});

manager.spawn(); // Spawn the shards