import { ShardingManager } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const manager = new ShardingManager('./dist/app.js', {
    token: process.env.DISCORD_TOKEN, // Bot token
    totalShards: process.env.NODE_ENV === 'test' ? 2 : 'auto', // Automatically determine the number of shards
});

manager.on('shardCreate', (shard) => {
    console.log(`Launched shard ${shard.id}`);
});

manager.spawn(); // Spawn the shards