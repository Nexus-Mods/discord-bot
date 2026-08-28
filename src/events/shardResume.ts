import { Client } from "discord.js";
import { Logger } from "../api/util.js";
import { DiscordEventInterface } from '../types/DiscordTypes.js';

// Events are registered by filename. discord.js v14 emits 'shardResume',
// not 'resume', so the previous version of this file never fired.
const main: DiscordEventInterface = {
    name: 'shardResume',
    once: false,
    execute(client: Client, logger: Logger, shardId: number, replayed: number) {
        logger.info(`Reconnected successfully, replaying ${replayed} events.`, { shardId });
    }
}

export default main;
