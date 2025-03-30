import { Client } from 'discord.js';
import { Logger } from '../api/util';
import { DiscordEventInterface } from '../types/DiscordTypes';

const main: DiscordEventInterface = {
    name: 'error',
    once: false,
    execute(client: Client, logger: Logger, error: Error) {
        logger.error('The bot has encountered an unexpected error', error);
        process.exit();
    }
}

export default main;