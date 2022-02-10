import { Client, Message } from 'discord.js';

async function run (client: Client, message: Message, args: string[], serverData: any) {
    return message.channel.send('Pong!');
}

export { run };