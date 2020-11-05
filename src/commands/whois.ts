import { Client, Message, GuildChannel, DMChannel, TextChannel, User, MessageEmbed } from "discord.js";
import { BotServer } from "../types/servers";
import { NexusUser, NexusUserServerLink } from "../types/users";
import { getUserByDiscordId, userEmbed, getAllUsers } from "../api/users";
import { getLinksByUser } from "../api/bot-db";

const help = {
    name: 'whois',
    description: 'Look up a user\'s profile card. If you do not share a server with the user you are searching for their information may be unavailable.',
    usage: '[Username | Discord ID]',
    moderatorOnly: false,
    adminOnly: false
}

async function run(client: Client, message: Message, args: string[], server: BotServer) {
    // Get reply channel
    const replyChannel: (GuildChannel| DMChannel | undefined | null) = server && server.channel_bot ? message.guild?.channels.resolve(server.channel_bot) : message.channel;
    const discordId: string = message.author.id;
    const prefix: string = replyChannel === message.channel ? message.author.username : message.author.toString();

    // Get info about the user making the request.
    const userData: NexusUser|undefined = await getUserByDiscordId(discordId).catch(() => undefined);

    // User isn't linked.
    if (!userData) return (replyChannel as TextChannel).send(`${prefix}, please link your Nexus Mods account to use this feature. See \`!nm link\` for more.`).catch(() => undefined);

    // No search query.
    if (!args.length) return (replyChannel as TextChannel).send(`${prefix}, to search for a user please follow the command with a Nexus Mods username, Discord username/tag or Discord ID.`).catch(() => undefined);

    // Join the query into a single string (in case it's a username with a space.)
    const query = args.join(' ').toLowerCase();

    // If the bot is pinged.
    if (message.mentions.users.first() === client.user || query === client.user?.username || query === client.user?.tag) {
        return (replyChannel as TextChannel).send('That\'s me!', await userEmbed(botUser(client), message, client)).catch(() => undefined);
    }

    // Get all the user accounts to make searching easier.
    const allUsers: NexusUser[]|undefined = await getAllUsers().catch(() => undefined);
    if (!allUsers) return (replyChannel as TextChannel).send(`${prefix}, member search failed for your query "${query}". Please try again later.`).catch(() => undefined);


    let foundNexus: NexusUser|undefined = findNexusUser(allUsers, query);
    let foundDiscord: User|undefined = findDiscordUser(client, query, message, foundNexus);

    // If we found the Discord user but not the Nexus Mods user, try again.
    if (foundDiscord && !foundNexus) foundNexus = findNexusUser(allUsers, query, foundDiscord);

    console.log(`${new Date().toLocaleString()} - Lookup result: ${foundNexus?.name || '???'} (Nexus) + ${foundDiscord?.tag} (Discord).`);

    // If we couldn't find one of the accounts, there is no match. 
    if (!foundDiscord || !foundNexus) return (replyChannel as TextChannel).send(`${prefix}, no members found for your search "${query}".`).catch(err => undefined);

    // Get server data for the Nexus Mods account we found.
    const foundServers: NexusUserServerLink[] = await getLinksByUser(foundNexus.id).catch(() => []);

    // Check if we should display the result, return if the user isn't in the current server.
    const isMe: boolean = userData.d_id === message.author.id;
    const inGuild: boolean = !!foundServers.find(link => link.server_id === message.guild?.id);
    if (!isMe || !inGuild) return (replyChannel as TextChannel).send(replyChannel === message.channel ? '' : message.author, notAllowed(client, message)).catch(() => undefined);

    // Send the profile card.
    const embed: MessageEmbed|void = await userEmbed(foundNexus, message, client).catch(console.error);
    if (embed) return (replyChannel as TextChannel).send(replyChannel !== message.channel ? prefix: '', embed).catch(() => undefined);

}

function findDiscordUser(client: Client, query: string, message: Message, nexus?: NexusUser): User|undefined {
    if (nexus) return client.users.resolve(nexus.d_id) || undefined;
    // Check for mentions
    if (message.mentions.users.first()) return message.mentions.users.first();
    // Check username, id and tag. 
    const guildMember = message.guild ? message.guild.members.cache.find(member => member.nickname?.toLowerCase() === query) : undefined;
    const user = client.users.cache.find(user => user.username.toLowerCase() === query.toLowerCase() || user.id === query);
    const tagUser = query.match(/.*#[0-9]{4}/) ? client.users.cache.find((u: User) => u.tag.toLowerCase() === query.trim()) : undefined;
    return ( guildMember?.user || user || tagUser );
}

function findNexusUser(allUsers: NexusUser[], query: string, discord?: User): NexusUser|undefined {
    if (discord) return allUsers.find(user => user.d_id === discord.id);
    return allUsers.find(user => query.toLowerCase() === user.name.toLowerCase());
}

const notAllowed = (client: Client, message: Message): MessageEmbed => {
    return new MessageEmbed()
    .setTitle('⛔  Profile Unavailable')
    .setColor('#ff0000')
    .setDescription('The user you are looking for is not a member of this server.')
    .setFooter(`Nexus Mods API Link - ${message.author.tag}: ${message.cleanContent}`, client.user?.avatarURL() || '');
}

const botUser = (client: Client): NexusUser => {
    const d_id = client.user?.id ? client.user?.id.toString() : '';
    const avatar_url = client.user?.avatarURL() || '';
    const servers: NexusUserServerLink[] = client.guilds.cache.map(g => { return { server_id: g.id, user_id: 1234042 } })

    return {
        d_id,
        id: 1234042,
        name: 'Nexus Mods Discord Bot',
        avatar_url,
        premium: false,
        supporter: false,
        lastupdate: new Date(),
        apikey: '',
        servers
    }
}

export { run, help };