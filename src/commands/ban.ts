import { Client, Message, GuildMember, TextChannel, MessageEmbed, Guild } from "discord.js";
import { BotServer } from "../types/servers";
import { CommandHelp } from "../types/util";
import { getUserByDiscordId } from "../api/users";
import { NexusUser } from "../types/users";

const help: CommandHelp = {
    name: "ban",
    description: "Bans this user from the server. Where possible attach screenshot of ban reason. This will be posted in the logging channel. **Moderator only.**\n_[#posts] - How many days of posts to remove (optional)\n[reason] - Reason for the ban (required)_",
    usage: "[@user] [reason] [#posts]",
    moderatorOnly: true,
    adminOnly: false,
    officialOnly: true
}

async function run(client: Client, message: Message, args: string[], server: BotServer) {
    if (!message.guild || !server.official) return;

    if (!message.member?.hasPermission('BAN_MEMBERS')) return;
    if (!message.guild.me?.hasPermission('BAN_MEMBERS')) return message.author.send(`I can't complete the requested ban in ${message.channel} as I don't have the required permissions.`).catch(() => undefined);

    if (!args.length) {
        message.author.send(`Ban failed in ${message.channel.toString()} (${message.guild.name}). Please specify a user to ban in the following format and attach a screenshot if required. \n \`!nexus ban {discordping} {reason} {?number of posts to remove (days)}\``).catch(() => undefined);
        return message.delete().catch(() => undefined);
    }

    // Get the channel to log the ban to.
    const logChannel: TextChannel|undefined = server.channel_nexus ? message.guild.channels.resolve(server.channel_nexus) as TextChannel : undefined;

    // If there is a number of posts to remove
    let postDays: number|string = args.length > 1 && !isNaN(parseInt(args.slice(-1)[0])) ? args.pop() || 0 : 0;
    postDays = typeof(postDays) === 'string' ? parseInt(postDays) : postDays;

    // Work out who we're banning.
    const query = args.join(' ');
    const userTag: string = query.includes('#') ? query.substr(0, query.indexOf('#') + 5) : '';
    const banMember: GuildMember|undefined = 
        message.mentions.members?.first() 
        || message.guild.members.cache.find(m => m.id === args[0])
        || message.guild.members.cache.find(m => m.user.tag.toLowerCase() === userTag.toLowerCase())
        || message.guild.members.cache.find(m => m.displayName.toLowerCase() === args[0])
        || message.guild.members.cache.find(m => m.user.username.toString() === args[0]);
    
    if (!banMember) {
        message.author.send(`Could not locate the user you were trying to ban in ${message.channel.toString()}.`).catch(() => undefined);
        return message.delete().catch(() => undefined)
    }

    if (banMember === message.member) return message.reply('You can\'t ban yourself!').catch(() => undefined);
    if (!banMember.bannable) return message.reply('I do not have permission to ban that user.').catch(() => undefined);

    let banReason: string = userTag? query.replace(userTag, '').trim() : query.replace(args[0], '').trim();
    if (!banReason.length) banReason = 'Breaching the Nexus Mods Terms of Service.';
    const evidence: string[] = message.attachments.map(attach => attach.proxyURL);
    const banMemberNexus: NexusUser|undefined = await getUserByDiscordId(banMember.id).catch(() => undefined);

    // Post a message to the nexus log channel
    const banLogMessage: Message|undefined = logChannel 
        ? await logChannel.send(logEmbed(message.member, banMember, banReason, postDays, evidence, banMemberNexus)).catch(() => undefined)
        : undefined;
    
    // DM the user (if possible)
    await banMember.user.send(youAreBanned(client, message.guild, banReason)).catch(() => {
        if (logChannel) logChannel.send(`${banMember.user.tag} does not accept DMs, so I could not inform them of the ban reason.`).catch(() => undefined);
    });

    const lastPostChannel: TextChannel | undefined = banMember.lastMessage?.channel as TextChannel;
    const channelNotice = channelEmbed(banMember, banLogMessage);

    if (lastPostChannel && lastPostChannel !== message.channel && lastPostChannel !== logChannel) lastPostChannel.send(channelNotice).catch(() => undefined);
    message.channel.send(channelNotice).catch(() => undefined);

    try {
        await banMember.ban({ days: postDays, reason: banReason });
        console.log(`${new Date().toLocaleString()} - ${banMember.user.username} (${banMember.user.tag}) has been banned by ${message.author.tag}`);
    }   
    catch(err) {
        message.reply(`${new Date().toLocaleString()} - There was an error banning ${banMember.user.toString()}. You may need to do it manually. \n${err.message}`);
    }

    return message.delete().catch(() => undefined);

}

const channelEmbed = (member: GuildMember, fullMsg: Message|undefined): MessageEmbed => {
    return new MessageEmbed()
    .setColor(16711680)
    .setDescription(`${member.user.toString()} (${member.user.tag}) has been banned from this server${fullMsg ? ` - [Staff Reference](${fullMsg.url}` : ""})`);
}

const youAreBanned = (client: Client, guild: Guild, reason: string): MessageEmbed => {
    return new MessageEmbed()
    .setColor(16711680)
    .setAuthor("Nexus Mods Moderation Team", client.user?.avatarURL() || '')
    .setThumbnail(guild.iconURL() || '')
    .setTitle(`You have been banned from the ${guild.name} Discord server!`)
    .setDescription(`**Reason:** \n${reason}`)
    .addField("Terms of Service", "You can review our [Terms of Service](https://help.nexusmods.com/category/10-policies-and-guidelines) here.")
    .addField("Can I appeal a ban?","We allow all banned users a single appeal. This will be reviewed by our staff who will decide if you can rejoin the server. \n [More Information](https://help.nexusmods.com/article/33-what-can-i-do-if-my-account-has-been-banned) ")
    .setFooter("No action has been taken against your Nexus Mods account at this time.", guild.iconURL() || '')
}

const logEmbed = (moderator: GuildMember, banUser: GuildMember, reason: string, posts: number, evidence: string[], nexus: NexusUser|undefined): MessageEmbed => {
    const embed = new MessageEmbed()
    .setColor(16711680)
    .setAuthor(moderator.user.username, moderator.user.avatarURL() || '')
    .setThumbnail(banUser.user.avatarURL() || '')
    .setTitle(`${banUser.user.tag} banned`)
    .setDescription(`${banUser.user.toString()} has been banned from this server by ${moderator.user.tag}`)
    .addField('Reason', reason)
    .setTimestamp(new Date())
    .setFooter('Nexus Mods Moderation Team', moderator.guild.iconURL() || '')

    if (posts > 0) embed.addField('Posts deleted', `Posts from this user from the last ${posts} day(s) has been deleted`)
    if (evidence.length) {
        embed.setImage(evidence[0])
        embed.addField('Related files', evidence.join('\n'))
    }
    if (nexus) embed.addField('Nexus Mods Profile', `[${nexus.name}](https://nexusmods.com/users/${nexus.id})`)



    return embed;

}

export { run, help }