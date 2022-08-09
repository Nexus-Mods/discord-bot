import { logMessage } from './api/util';
import { DiscordBot } from './DiscordBot';

require('dotenv').config();

const bot = DiscordBot.getInstance();

(async () => {
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
})