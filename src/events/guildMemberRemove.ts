import { Guild, GuildMember, User } from 'discord.js';
import { ClientExt } from '../DiscordBot';
import { getUserByDiscordId, getLinksByUser, deleteAllServerLinksByUser, deleteUser, deleteServerLink } from '../api/bot-db';


async function main(client: ClientExt, member: GuildMember) {
    const discordUser: User = member.user;
    const guild: Guild = member.guild;
    const nexusUser = await getUserByDiscordId(discordUser.id).catch(() => undefined);
    if (!discordUser || !nexusUser) return;

    return deleteServerLink(client, nexusUser, discordUser, guild).catch(() => undefined);
}

export default main;