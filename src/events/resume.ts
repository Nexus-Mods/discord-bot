import { Client } from "discord.js";
import { logMessage } from "../api/util";
import { DiscordEventInterface } from '../types/DiscordTypes';

const main: DiscordEventInterface = {
    name: 'resume',
    once: false,
    execute(client: Client, replayed: number) {
        logMessage(`Reconnected successfully, replaying ${replayed} events.`);
    }
}

export default main; 