import { type Client, EmbedBuilder } from 'discord.js';
import { AppError } from '../api/errors.js';

/**
 * Shared embed furniture.
 *
 * Before this existed the brand colour was written out 29 times, the bot's avatar
 * fallback `client.user?.avatarURL() || ''` about 30 times, and the footer text in
 * four spellings that differed only in casing and quote style.
 */

/**
 * Nexus Mods orange, as the website renders it.
 *
 * This is Tailwind's orange-400 - `oklch(75% 0.183 55.934)` - which is what
 * `--color-primary-400` aliases to in the Nexus Mods theme layer, mirrored for the
 * front-end in apps/web/app/globals.css. Discord embeds take a flat sRGB integer, so
 * the oklch has to be resolved down to one, and that colour is very slightly outside
 * the sRGB gamut (linear red comes out at 1.029), which means the answer depends on
 * how it is brought back in:
 *
 *   #ff8904  channel clipping - what Chromium actually paints, so what a visitor to
 *            nexusmods.com sees. Taken by painting the oklch to a canvas and reading
 *            the pixel back, rather than by converting it by hand.
 *   #ff8b1a  chroma-reduced gamut mapping - what Lightning CSS emits as the fallback
 *            for browsers with no oklch support. A different, slightly duller orange.
 *
 * The first one is the one people see, so it is the one used here.
 *
 * Was 0xda8e35 up to 4.4.0: an older, browner orange that visibly disagreed with the
 * site in any embed linking to a page.
 */
export const NEXUS_ORANGE = 0xff8904;

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
