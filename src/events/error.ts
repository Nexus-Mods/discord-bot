import { Client } from 'discord.js';
import { logMessage } from '../api/util';
import { DiscordEventInterface } from '../types/DiscordTypes';

const main: DiscordEventInterface = {
    name: 'error',
    once: false,
    execute(client: Client, error: Error) {
        logMessage('The bot has encountered an unexpected error', error , true);
        process.exit();
    }
}

export default main;