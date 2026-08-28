import { Client } from "discord.js";
import { Logger } from "../api/util";
import { DiscordEventInterface } from '../types/DiscordTypes';

// Events are registered by filename. discord.js v14 emits 'shardReconnecting',
// not 'reconnecting', so the previous version of this file never fired.
const main: DiscordEventInterface = {
    name: 'shardReconnecting',
    once: false,
    execute(client: Client, logger: Logger, shardId: number) {
        logger.info('Reconnecting to Discord...', { shardId });
    }
}

export default main;
