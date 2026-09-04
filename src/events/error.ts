import type { Client } from 'discord.js';
import type { Logger } from "../api/logger.js";
import type { DiscordEventInterface } from '../types/DiscordTypes.js';

const main: DiscordEventInterface = {
    name: 'error',
    once: false,
    execute(client: Client, logger: Logger, error: Error) {
        // discord.js emits this for recoverable gateway problems and reconnects on its own.
        // Exiting here turned every transient error into a restart.
        logger.error('The bot has encountered an unexpected error', error);
    }
}

export default main;