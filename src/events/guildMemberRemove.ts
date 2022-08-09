import { Guild, GuildMember, User } from 'discord.js';
import { getUserByDiscordId, deleteServerLink } from '../api/bot-db';
import { logMessage } from '../api/util';
import { DiscordEventInterface, ClientExt } from '../types/DiscordTypes';

const main: DiscordEventInterface = {
    name: 'guildMemberRemove',
    once: false,
    async execute(client: ClientExt, member: GuildMember) {
        const discordUser: User = member.user;
        const guild: Guild = member.guild;
        const nexusUser = await getUserByDiscordId(discordUser.id).catch(() => undefined);
        if (!discordUser || !nexusUser) return;
        
        logMessage('Linked user has left the server, removing link', { guild: guild.name, nexus: nexusUser.name, discord: discordUser.tag });
        await deleteServerLink(client, nexusUser, discordUser, guild).catch(() => undefined);
    }
}

export default main;