import dotenv from 'dotenv';
dotenv.config();
import { logMessage } from './api/util';
import { DiscordBot } from './DiscordBot';
import { AuthSite } from './server/server';

const bot = DiscordBot.getInstance();
start();

async function start() {
    // Log the shard ID (if running in a shard)
    if (bot.client.shard) {
        const shardId = bot.client.shard.ids[0];
        logMessage(`Starting shard ${shardId}`);
    }

    // Login with the Discord bot. 
    try {
        await bot.connect();
    }
    catch(err) {
        logMessage('Failed to connect Discord bot', err, true);
        process.exit();
    }

    // Set up slash commands (if required)
    try {
        await bot.setupInteractions();
    }
    catch(err) {
        logMessage('Failed to set up Discord bot interactions', err, true);
        process.exit();
    }

    // Set up the OAuth portal
    try {
        const site = AuthSite.getInstance(bot.client);
    }
    catch(err) {
        logMessage('Failed to set up Auth website', err, true);
    }
}