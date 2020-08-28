import { Client } from 'discord.js';

async function main (client: Client, error: Error) {
    console.error(`${new Date().toLocaleString()} - The bot has encountered an error.`, error);
}

export default main;