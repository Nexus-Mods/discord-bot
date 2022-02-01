import { Client } from 'discord.js';
import { logMessage } from '../api/util';

function main(client: Client, replayed: number) {
    logMessage(`Reconnected successfully, replaying ${replayed} events.`);
}

export default main;