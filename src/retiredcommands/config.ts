import { CommandHelp } from "../types/util";
import { Client, Message, MessageEmbed, Guild, Role, GuildChannel, ThreadChannel, GuildMember } from "discord.js";
import { BotServer } from "../types/servers";
import { NexusUser } from "../types/users";
import { getUserByDiscordId, updateServer } from "../api/bot-db";
import { IGameInfo } from "@nexusmods/nexus-api";
import { games } from "../api/nexus-discord";

const help: CommandHelp = {
    name: "config",
    description: "Configure the settings for your server.",
    usage: "[setting] [newvalue]",
    moderatorOnly: false,
    adminOnly: true,
    officialOnly: false 
}

async function run(client: Client, message: Message, args: string[], server: BotServer) {
    // Ignore this command in DMs
    if (!message.guild || !server) return;

    if (!message.member?.permissions.has('ADMINISTRATOR')) return message.channel.send('Server configuration is only available to admininstrators.').catch(() => undefined);

    const user: NexusUser|undefined = await getUserByDiscordId(message.author.id).catch(() => undefined);
    const allGames: IGameInfo[] = user? await games(user) : [];
    const filterGame: IGameInfo|undefined = allGames.length && server.game_filter ? allGames.find(g => g.id.toString() === server.game_filter?.toString()) : undefined;

    if (!args.length) return message.channel.send({ embeds: [await serverEmbed(client, message.guild, server, filterGame?.name)] }).catch(() => undefined);

    let newData: any = {name: '', new: undefined, data: {}};
    
    switch(args[0]) {
        case 'linked':
            newData.name = 'Linked Role';
            newData.cur = server.role_linked;
            newData.new = message.mentions.roles.first();
            newData.data.role_linked = newData.new?.id;
            break;
        case 'author':
            newData.name = 'Mod Author Role';
            newData.cur = server.role_author;
            newData.new = message.mentions.roles.first();
            newData.data.role_author = newData.new?.id;
            break;
        case 'premium':
            newData.name = 'Premium Role';
            newData.cur = server.role_premium;
            newData.new = message.mentions.roles.first();
            newData.data.role_premium = newData.new?.id;
            break;
        case 'supporter':
            newData.name = 'Supporter Role';
            newData.cur = server.role_supporter;
            newData.new = message.mentions.roles.first();
            newData.data.role_supporter = newData.new?.id;
            break;
        case 'replyonly':
            newData.name = 'Reply Channel';
            newData.cur = server.channel_bot;
            newData.new = message.mentions.channels.first();
            newData.data.channel_bot = newData.new?.id;
            break;
        case 'log':
            newData.name = 'Log Channel';
            newData.cur = server.channel_nexus;
            newData.new = message.mentions.channels.first();
            newData.data.channel_nexus = newData.new?.id;
            break;
        case 'filter':
            if (!user && args[1]) return message.channel.send('Unable to set game filter. Please link your Nexus Mods acount first. See `!nm link` for more.').catch(() => undefined);
            newData.name = 'Game Filter';
            newData.cur = server.game_filter ? resolveFilter(allGames, server.game_filter?.toString()) : undefined;
            newData.new = resolveFilter(allGames, args.slice(1).join(' '));
            newData.data.game_filter = newData.new?.id;
            break;
        default:
            return message.channel.send(`Unrecognised command: ${args[0]}`).catch(() => undefined);
    }

    try {
        await updateServer(server.id, newData.data)
        return message.channel.send({ embeds: [updateEmbed(newData)] }).catch(() => undefined);        
    }
    catch(err: any) {
        return message.channel.send(`Error updating your server data: ${err.message || err}`).catch(() => undefined)
    }

    
}

function resolveFilter(games: IGameInfo[], term: string|undefined): IGameInfo|undefined {
    if (!term || !games.length) return;
    const game = games.find(g => g.name.toLowerCase() === term.toLowerCase() || g.domain_name.toLowerCase() === term.toLowerCase() || g.id === parseInt(term));
    return game;
}

const updateEmbed = (data: any): MessageEmbed => { 
    const curVal = (data.cur as IGameInfo) ? data.cur?.name : !data.cur ? '*none*' : data.cur?.toString();
    const newVal = (data.new as IGameInfo) ? data.new?.name : !data.new ? '*none*' : data.cur?.toString();
    return new MessageEmbed()
    .setTitle('Configuration updated')
    .setColor(0xda8e35)
    .setDescription(`${data.name} updated from ${curVal} to ${newVal}`);
}

const serverEmbed = async (client: Client, guild: Guild, server: BotServer, gameName?: string): Promise<MessageEmbed> => {
    const linkedRole: Role|null = server.role_linked ? guild.roles.resolve(server.role_linked) : null;
    const premiumRole: Role|null = server.role_premium ? guild.roles.resolve(server.role_premium) : null;
    const supporterRole: Role|null = server.role_supporter ? guild.roles.resolve(server.role_supporter) : null;
    const authorRole: Role|null = server.role_author ? guild.roles.resolve(server.role_author) : null;
    const botChannel: ThreadChannel | GuildChannel|null = server.channel_bot ? guild.channels.resolve(server.channel_bot) : null;
    const nexusChannel: ThreadChannel | GuildChannel|null = server.channel_nexus ? guild.channels.resolve(server.channel_nexus) : null;
    const logChannel: ThreadChannel | GuildChannel|null = server.channel_log ? guild.channels.resolve(server.channel_log) : null;
    const newsChannel: ThreadChannel|GuildChannel|null = server.channel_news ? guild.channels.resolve(server.channel_news) : null;
    const owner: GuildMember = await guild.fetchOwner();

    const embed = new MessageEmbed()
    .setAuthor({ name: guild.name, iconURL: guild.iconURL() || '' })
    .setTitle(`Server Configuration - ${guild.name}`)
    .setDescription('Configure any of these options for your server by typing the following command: \n`!NM config <setting> <newvalue>`')
    .setColor(0xda8e35)
    .addField(
        'Role Settings', 
        'Set roles for linked accounts, mod authors and Nexus Mods memberships.\n\n'+
        `**Connected Accounts:** ${linkedRole?.toString() || '*Not set*'} - set using \`linked <@role>\`\n`+
        `**Mod Authors:** ${authorRole?.toString() || '*Not set*'} - set using \`author <@role>\`\n`+
        `**Supporter/Premium:** ${supporterRole?.toString() || '*Not set*'}/${premiumRole?.toString() || '*Not set*'} - set using \`premium <@role>\` or \`supporter <@role>\``
    )
    .addField(
        'Channel Settings',
        'Set a bot channel to limit bot replies to one place or set a channel for bot logging messages.\n\n'+
        `**Reply Channel:** ${botChannel?.toString() || '*<any>*'} - set using \`replyonly <#channel>\`\n`+
        `**Log Channel:** ${nexusChannel?.toString() || '*Not set*'} - set using \`log <#channel>\``
    )
    .addField(
        'Search', 
        `Showing ${server.game_filter ? `mods from ${gameName || server.game_filter}` : 'all games' }. - set using \`filter <game name/domain>\``
    )
    .setFooter({ text: `Server ID: ${guild.id} | Owner: ${owner?.user.tag}`, iconURL: client.user?.avatarURL() || '' });

    if (newsChannel || logChannel) embed.addField('Depreciated Channels', `News: ${newsChannel?.toString() || 'n/a'}, Log: ${logChannel?.toString() || 'n/a'}`);
    if (server.official) embed.addField('Official Nexus Mods Server', 'This server is an official Nexus Mods server, all bot functions are enabled.');

    return embed;
}

export { run, help };