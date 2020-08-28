import { Client } from 'discord.js';

function main(client: Client, replayed: number) {
    console.log(`${new Date().toLocaleString()} - Reconnected successfully, replaying ${replayed} events.`)    
}

export default main;