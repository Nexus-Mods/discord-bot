import { CDN, REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import type { APIGuild, APIGuildChannel, GuildChannelType } from 'discord-api-types/v10';
import { logger } from '@nexusmods/core/logger.js';

/**
 * The only thing this site needs from Discord: guild and channel names for the tracking
 * page.
 *
 * @discordjs/rest and discord-api-types, not discord.js. Importing REST from discord.js
 * works and drags the gateway client in behind it - the step 8 build failed outright on
 * zlib-sync, an optional native dependency of @discordjs/ws - and a web request has no
 * business opening a gateway connection. discord.js re-exports these two; this is where
 * they live.
 *
 * A second copy of apps/bot/src/server/discordDirectory.ts for one step, the same trade as
 * the forum webhook: Express still serves /tracking until step 10, that copy imports
 * discord.js quite legitimately because the bot has a gateway anyway, and the alternative
 * was a package that step 10 would immediately dissolve.
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

/**
 * One REST client per process, on globalThis for the same reason the connection pools are
 * - Next re-evaluates this module on every save in dev, and a fresh REST client per reload
 * means a fresh set of keep-alive sockets to Discord and a rate-limit bucket that has
 * forgotten everything the last one knew.
 */
const CLIENT = Symbol.for('@nexusmods/discord-web.rest');

interface ClientHost { [CLIENT]?: { rest: REST; cdn: CDN } }

function client(): { rest: REST; cdn: CDN } {
    const host = globalThis as ClientHost;
    if (host[CLIENT]) return host[CLIENT];

    const token = process.env.DISCORD_TOKEN;
    // bootCheck refuses to start the site without this, so reaching here means the
    // environment changed under a running process.
    if (!token) throw new Error('DISCORD_TOKEN is not set, so guild and channel names cannot be resolved.');

    host[CLIENT] = { rest: new REST({ version: '10' }).setToken(token), cdn: new CDN() };
    return host[CLIENT];
}

/**
 * `guilds.fetch()` threw for an unknown id rather than returning undefined, so the
 * `if (!knownGuild)` guard on the tracking page never fired and any visitor could turn a
 * guessed guild id into a 500. Not found is a value here, not an exception.
 */
function isNotFound(err: unknown): boolean {
    const status = (err as { status?: number })?.status;
    return status === 403 || status === 404;
}

/** Resolves to null when the guild does not exist or the bot is not in it. */
export async function guild(id: string): Promise<GuildSummary | null> {
    const { rest, cdn } = client();
    try {
        const found = (await rest.get(Routes.guild(id))) as APIGuild;
        return {
            id: found.id,
            name: found.name,
            iconUrl: found.icon ? cdn.icon(found.id, found.icon, { size: 128 }) : null,
        };
    }
    catch (err) {
        if (isNotFound(err)) return null;
        logger.warn('Could not fetch guild from Discord', { guild: id, err });
        throw err;
    }
}

export async function channels(guildId: string): Promise<ChannelSummary[]> {
    const { rest } = client();
    try {
        // One request for the whole guild rather than one per subscribed channel, which is
        // what the per-channel fetch() calls cost without their cache.
        const list = (await rest.get(Routes.guildChannels(guildId))) as APIGuildChannel<GuildChannelType>[];
        return list.map((c) => ({ id: c.id, name: c.name ?? 'Unknown Channel' }));
    }
    catch (err) {
        if (isNotFound(err)) return [];
        logger.warn('Could not fetch channels from Discord', { guild: guildId, err });
        throw err;
    }
}
