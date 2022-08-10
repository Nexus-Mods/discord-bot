import { Client } from "discord.js";
import { logMessage } from "../api/util";
import { DiscordEventInterface } from '../types/DiscordTypes';

const main: DiscordEventInterface = {
    name: 'reconnecting',
    once: false,
    execute(client: Client) {
        logMessage('Reconnecting to Discord...');
    }
}

export default main; 