import { Client, EmbedBuilder } from 'discord.js';

/**
 * Shared embed furniture.
 *
 * Before this existed the brand colour was written out 29 times, the bot's avatar
 * fallback `client.user?.avatarURL() || ''` about 30 times, and the footer text in
 * four spellings that differed only in casing and quote style.
 */

/** Nexus Mods orange. */
export const NEXUS_ORANGE = 0xda8e35;

/** The bot's avatar, or an empty string - setFooter rejects undefined. */
export function botIconUrl(client: Client): string {
    return client.user?.avatarURL() ?? '';
}

/** Footer for anything sourced from the Nexus Mods API. */
export function apiLinkFooter(client: Client): { text: string; iconURL: string } {
    return { text: 'Nexus Mods API link', iconURL: botIconUrl(client) };
}

/** Footer for the bot's own output, as opposed to API data. */
export function botFooter(client: Client): { text: string; iconURL: string } {
    return { text: 'Discord Bot - Nexus Mods', iconURL: botIconUrl(client) };
}

/** A pre-branded embed. Equivalent to new EmbedBuilder().setColor(NEXUS_ORANGE). */
export function nexusEmbed(): EmbedBuilder {
    return new EmbedBuilder().setColor(NEXUS_ORANGE);
}
