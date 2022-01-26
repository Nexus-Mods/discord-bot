import { Message, GuildChannel, PartialDMChannel, DMChannel, TextChannel, MessageEmbed, ThreadChannel } from "discord.js";
import { BotServer } from "../types/servers";
import { ClientExt } from "../DiscordBot";
import { CommandHelp } from "../types/util";
import path from 'path';

const help: CommandHelp = {
    name: "help",
    description: "Displays bot functions and their descriptions. Use [command] for a specific command.",
    usage: "[command]",
    moderatorOnly: false,
    adminOnly: false  
}

async function run(client: ClientExt, message: Message, args: string[], server: BotServer) {
    const replyChannel: (GuildChannel | PartialDMChannel | DMChannel | ThreadChannel | undefined | null) = server && server.channel_bot ? message.guild?.channels.resolve(server.channel_bot) : message.channel;
    const rc = (replyChannel as TextChannel);

    // Check permissions
    const moderator: boolean = message.guild ? message.member?.permissions.has('BAN_MEMBERS') || false : false;
    const admin: boolean =  message.guild ? message.member?.permissions.has('ADMINISTRATOR') || false : false;
    const official: boolean = server ? server.official : false;

    // Check for args
    const query: string|undefined = args[0]?.toLowerCase();

    //Check for commands that don't exist.
    if ( query && !client.commands?.get(query)) return rc.send(`Could not find a command for "${query}".`);

    const helpEmbed: MessageEmbed = new MessageEmbed()
    .setTitle('Nexus Mods Discord Bot Help')
    .setAuthor({name: client.user?.username || '', iconURL: client.user?.avatarURL() || '' })
    .setColor(0xda8e35)
    .setDescription(`All commands for this bot can be accessed with one of the following prefixes: ${client.config.prefix.join(', ')}.`)
    .setFooter({text:`Nexus Mods bot - ${message.author.tag}: ${message.cleanContent}`, iconURL: client.user?.avatarURL() || ''});
    if (query) {
        const props = require(`${__dirname}\\${query}.js`);
        const help: CommandHelp = props.help;
        if (!help) return rc.send(`No help text for ${query}`).catch(() => undefined);
        else if (!moderator && help.moderatorOnly || !admin && help.adminOnly || !official && help.officialOnly) return rc.send(`You do not have permission to use the ${query} command.`).catch(() => undefined)
        else helpEmbed.addField(`${help.name} ${help.usage}`, help.description);
        return (help.moderatorOnly || help.adminOnly) 
            ? rc.send({ embeds: [helpEmbed] }).catch(() => undefined)
            : message.author.send({ embeds: [helpEmbed] }).catch(() => rc.send(message.author+' - Please enable DMs so I can send you the help text.').catch(() => undefined));
    }
    else {
        const commandKeys: any[] = client.commands?.map((value, key) => key) || [];
        helpEmbed.addFields(commandKeys.reduce((prev: any[], cur: string) => {
            const props = require(path.join(__dirname, `${cur}.js`));
            if (!props.help) return prev;
            const help: CommandHelp = props.help;
            if (!moderator && help.moderatorOnly || !admin && help.adminOnly || !official && help.officialOnly) return prev;
            prev.push({ name: `${help.name} ${help.usage}`, value: help.description });
            return prev;
        }, []).slice(0, 25));
        if (admin || moderator) return message.author.send({ embeds: [helpEmbed] }).catch(() => rc.send(message.author+' - Please allow DMs so I can send you the help info.').catch(() => undefined));
        return rc.send({ embeds: [helpEmbed] }).catch(() => undefined);
    }
}

export { run, help };