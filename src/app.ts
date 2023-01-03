import * as dotenv from 'dotenv';
dotenv.config();
import { logMessage } from './api/util';
import { DiscordBot } from './DiscordBot';
import { AuthSite } from './server/server';

const bot = DiscordBot.getInstance();
start();

async function start() {
    try {
        await bot.connect();
    }
    catch(err) {
        logMessage('Failed to connect Discord bot', err, true);
        process.exit();
    }

    try {
        await bot.setupInteractions();
    }
    catch(err) {
        logMessage('Failed to set up Discord bot interactions', err, true);
        process.exit();
    }

    try {
        const site = AuthSite.getInstance();
    }
    catch(err) {
        logMessage('Failed to set up Auth website', err, true);
    }
}