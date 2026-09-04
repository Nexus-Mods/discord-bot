import { type Client, EmbedBuilder, type Snowflake, type User } from 'discord.js';
import type { NexusUser } from '../types/users.js';
// Type-only: the embeds take a DiscordBotUser but never construct one, so this edge
// is erased at compile time and does not recreate the cycle it was moved to break.
import type { DiscordBotUser } from '../api/DiscordBotUser.js';
import { logger } from '../api/logger.js';
import { nexusModsTrackingUrl } from '../api/formatting.js';
import { apiLinkFooter, botIconUrl, NEXUS_ORANGE } from './embeds.js';

// These two were duplicated verbatim between whois.ts and user-profile.ts.

/** A stand-in NexusUser representing the bot itself, for /whois on the bot. */
export const botUser = (client: Client): NexusUser => {
    const d_id: Snowflake = client.user?.id ? client.user.id.toString() as Snowflake : '' as Snowflake;
    return {
        d_id,
        id: 1234042,
        name: 'Nexus Mods Discord Bot',
        avatar_url: botIconUrl(client),
        premium: false,
        supporter: false,
        lastupdate: new Date(),
    }
}

/** Shown when the requested profile belongs to someone outside this server. */
export const notAllowed = (client: Client): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle('\u26d4  Profile Unavailable')
    .setColor('#ff0000')
    .setDescription('The user you are looking for is not a member of this server.')
    .setFooter(apiLinkFooter(client));
}


/**
 * User-facing embeds.
 *
 * These lived in api/users.ts, which meant DiscordBotUser imported the persistence
 * module purely to render itself - one half of a runtime import cycle. They take the
 * user as a parameter, so here they need only the *type*, which the compiler erases.
 */
export async function userEmbed(userData: NexusUser, client: Client): Promise<EmbedBuilder> {
    try {
        const discordUser: User = await client.users.fetch(userData.d_id);
        if (!discordUser) throw new Error('Unknown User');

        const embed = new EmbedBuilder()
            .setAuthor({ name: "Member Search Results", iconURL: discordUser.avatarURL() || undefined })
            .addFields({
                name: "Nexus Mods",
                value: `[${userData.name}](https://nexusmods.com/users/${userData.id})\n${userData.premium ? "Premium Member" : userData.supporter ? "Supporter" : "Member"}`,
                inline: true
            })
            .addFields({ name: "Discord", value: `${discordUser.toString()}\n${discordUser.tag}`, inline: true })
            .setColor(NEXUS_ORANGE)
            .setThumbnail(userData.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
            .setTimestamp(userData.lastupdate)
            .setFooter({ text: `User ID: ${userData.id}`, iconURL: botIconUrl(client) });


        return embed;
    }
    catch (err) {
        logger.error('Error creating user embed', { userData, err });
        throw err;
    }
}

export async function userProfileEmbed(user: DiscordBotUser, client: Client): Promise<EmbedBuilder> {
    try {
        const discordUser: User = await user.Discord.User(client);
        if (!discordUser) throw new Error('Unknown User');

        const roleToShow: string = user.NexusModsRoles.has('premium')
            ? "Premium Member" : user.NexusModsRoles.has('modauthor')
                ? "Mod Author" : user.NexusModsRoles.has('supporter')
                    ? "Supporter" : "Member";

        const embed = new EmbedBuilder()
            .setAuthor({ name: "Member Search Results", iconURL: discordUser.avatarURL() || undefined })
            .addFields({
                name: "Nexus Mods",
                value: `[${user.NexusModsUsername}](${nexusModsTrackingUrl(`https://nexusmods.com/users/${user.NexusModsId}`, 'profile')})\n${roleToShow}`,
                inline: true
            })
            .addFields({ name: "Discord", value: `${discordUser.toString()}\n${discordUser.tag}`, inline: true })
            .setColor(NEXUS_ORANGE)
            .setThumbnail(user.NexusModsAvatar || 'https://www.nexusmods.com/assets/images/default/avatar.png')
            .setTimestamp(user.LastUpdated)
            .setFooter({ text: `User ID: ${user.NexusModsId}`, iconURL: botIconUrl(client) });

        return embed;
    }
    catch (err) {
        logger.error('Error creating user profile embed', { nexusModsId: user.NexusModsId, err });
        throw err;
    }
}
