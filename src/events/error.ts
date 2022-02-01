import { Client } from 'discord.js';
import { logMessage } from '../api/util';

async function main (client: Client, error: Error) {
    logMessage('The bot has encountered an unexpected error', error , true);
}

export default main;