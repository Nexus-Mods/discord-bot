import { type Client, EmbedBuilder } from 'discord.js';
import { AppError } from '../api/errors.js';

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

export const unexpectedErrorEmbed = (err: any, context: any, errorId?: string): EmbedBuilder => {
    // Only an AppError carries text written for a user. Everything else gets a generic
    // line plus a reference to quote, because an arbitrary err.message can contain
    // anything - that is how an access token once ended up rendered into an embed.
    const detail = err instanceof AppError
        ? err.userMessage
        : 'The bot hit an unexpected problem. The details have been recorded.';
    const operational = err instanceof AppError ? err.isOperational : false;
    return new EmbedBuilder()
    .setTitle('Unexpected error')
    .setColor('DarkRed')
    .setDescription(operational
        ? 'The bot hit a problem running this command. It is usually temporary - please try again in a few minutes.'
        : 'The bot encountered an unexpected error with this command. Please report it, quoting the reference below.')
    .addFields([
        {
            name: 'What happened', value: detail.substring(0, 1010)
        },
        {
            name: 'Reference', value: `\`${errorId ?? 'not recorded'}\``
        },
        {
            name: 'Context', value: `\`\`\`json\n${JSON.stringify(context, null, 2).substring(0, 1010)}\n\`\`\``
        },
        {
            name: 'Reporting the error', value: 'Please report this on [GitHub](https://github.com/Nexus-Mods/discord-bot/issues/) or the [Nexus Mods server](https://discord.gg/nexusmods).'
        }
    ])
}
