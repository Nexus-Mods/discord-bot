import { Client } from "discord.js";
import { Logger } from "../api/util";
import { DiscordEventInterface } from '../types/DiscordTypes';

const main: DiscordEventInterface = {
    name: 'reconnecting',
    once: false,
    execute(client: Client, logger: Logger) {
        logger.info('Reconnecting to Discord...');
    }
}

export default main; 