import { Message } from 'discord.js';
import { ClientExt } from '../DiscordBot';
import { BotServer } from '../types/servers';
import { getServer } from '../api/bot-db';


async function main (client: ClientExt, message: Message) {
    // Ignore bot posts.
    if (message.author.bot) return;

    // Prefix checks
    let botMention = (message.guild && message.mentions.members?.first() === message.guild.me);
    let prefix : string | undefined = botMention ? message.guild?.me?.toString() : undefined;
    for (const thisprefix of client.config.prefix) {
        if (message.content.startsWith(thisprefix)) prefix = thisprefix;
    }
    // The prefix wasn't used. 
    if (!prefix) return;

    // Split out args and command name.
    const args : string[] = message.content.slice(prefix.length).trim().split(/ +/g);
    const command: string | undefined = args.shift()?.toLowerCase();
    const cmd = client.commands?.get(command);
    
    // No command found.
    if (!cmd) return;

    // Get server data. 
    const serverData: BotServer|undefined = message.guild 
        ? await getServer(message.guild).catch(() => undefined) 
        : undefined;

    cmd.run(client, message, args, serverData);
}

export default main;