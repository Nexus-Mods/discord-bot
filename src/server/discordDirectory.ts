import { CDN, REST, Routes } from 'discord.js';
import type { APIGuild, APIGuildChannel, GuildChannelType } from 'discord.js';
import type { Logger } from '../api/util.js';

/**
 * The only thing the auth site needs from Discord.
 *
 * The site used to take the gateway `Client` so the tracking page could call
 * `guilds.fetch()` and `channels.fetch()`. Both are REST calls behind a cache, and
 * they were the single reason a web request needed a logged-in bot to exist in the
 * same process. Expressed as an interface over `REST`, the site no longer needs a
 * gateway connection, a shard, or discord.js's caches - only a bot token.
 */
export interface GuildSummary {
    id: string;
    name: string;
    iconUrl: string | null;
}

export interface ChannelSummary {
    id: string;
    name: string;
}

export interface DiscordDirectory {
    /** Resolves to null when the guild does not exist or the bot is not in it. */
    guild(id: string): Promise<GuildSummary | null>;
    channels(guildId: string): Promise<ChannelSummary[]>;
}

/**
 * `guilds.fetch()` threw for an unknown id rather than returning undefined, so the
 * `if (!knownGuild)` guard on the tracking page never fired and any visitor could turn
 * a guessed guild id into a 500. Not found is a value here, not an exception.
 */
function isNotFound(err: unknown): boolean {
    const status = (err as { status?: number })?.status;
    return status === 403 || status === 404;
}

export function createDiscordDirectory(token: string, logger: Logger): DiscordDirectory {
    const rest = new REST({ version: '10' }).setToken(token);
    const cdn = new CDN();

    return {
        async guild(id: string): Promise<GuildSummary | null> {
            try {
                const guild = (await rest.get(Routes.guild(id))) as APIGuild;
                return {
                    id: guild.id,
                    name: guild.name,
                    iconUrl: guild.icon ? cdn.icon(guild.id, guild.icon, { size: 128 }) : null,
                };
            }
            catch (err) {
                if (isNotFound(err)) return null;
                logger.warn('Could not fetch guild from Discord', { guild: id, err });
                throw err;
            }
        },

        async channels(guildId: string): Promise<ChannelSummary[]> {
            try {
                // One request for the whole guild rather than one per subscribed channel,
                // which is what the per-channel fetch() calls cost without their cache.
                const channels = (await rest.get(Routes.guildChannels(guildId))) as APIGuildChannel<GuildChannelType>[];
                return channels.map((c) => ({ id: c.id, name: c.name ?? 'Unknown Channel' }));
            }
            catch (err) {
                if (isNotFound(err)) return [];
                logger.warn('Could not fetch channels from Discord', { guild: guildId, err });
                throw err;
            }
        },
    };
}
