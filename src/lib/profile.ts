import { Client, EmbedBuilder, Snowflake } from 'discord.js';
import { NexusUser } from '../types/users.js';
import { apiLinkFooter, botIconUrl } from './embeds.js';

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
