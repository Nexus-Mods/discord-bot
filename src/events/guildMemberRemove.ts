import { Guild, GuildMember, User } from 'discord.js';
import { ClientExt } from '../DiscordBot';
import { getUserByDiscordId, deleteServerLink } from '../api/bot-db';
import { logMessage } from '../api/util';


async function main(client: ClientExt, member: GuildMember) {
    const discordUser: User = member.user;
    const guild: Guild = member.guild;
    const nexusUser = await getUserByDiscordId(discordUser.id).catch(() => undefined);
    if (!discordUser || !nexusUser) return;
    
    logMessage('Linked user has left the server, removing link', { guild: guild.name, nexus: nexusUser.name, discord: discordUser.tag });
    return deleteServerLink(client, nexusUser, discordUser, guild).catch(() => undefined);
}

export default main;