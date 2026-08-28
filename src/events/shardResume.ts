import { Client } from "discord.js";
import { Logger } from "../api/util";
import { DiscordEventInterface } from '../types/DiscordTypes';

const main: DiscordEventInterface = {
    name: 'resume',
    once: false,
    execute(client: Client, logger: Logger, replayed: number) {
        logger.info(`Reconnected successfully, replaying ${replayed} events.`);
    }
}

export default main; 