import { CDN, REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import type { APIGuild, APIGuildChannel, APIRole, GuildChannelType } from 'discord-api-types/v10';
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

/**
 * A short memo on guild lookups, shared by every visitor.
 *
 * The manage rail asks "is the bot in this guild, and what is it called" once per server
 * the visitor manages, on every navigation. None of that changes minute to minute, and
 * none of it is specific to who is asking - a guild's name, icon and the bot's presence
 * in it are the same facts for everyone - so one answer can serve them all.
 *
 * Deliberately NOT how permissions are handled. Those are read live every time, because
 * a stale permission is an authorisation bug where a stale server name is a cosmetic one.
 *
 * On globalThis for the same reason the REST client is: Next re-evaluates this module on
 * every save in dev, and a per-reload cache is no cache at all.
 */
const GUILD_TTL_MS = 5 * 60 * 1000;
const GUILD_CACHE = Symbol.for('@nexusmods/discord-web.guildCache');

interface Cached { value: GuildSummary | null; at: number }
interface CacheHost { [GUILD_CACHE]?: Map<string, Cached> }

function guildCache(): Map<string, Cached> {
    const host = globalThis as CacheHost;
    host[GUILD_CACHE] ??= new Map();
    return host[GUILD_CACHE];
}

/** Drops what has expired. Called on write, so an idle process does not hold a map forever. */
function pruneGuildCache(now: number): void {
    const cache = guildCache();
    if (cache.size < 200) return;
    for (const [key, entry] of cache) {
        if (now - entry.at >= GUILD_TTL_MS) cache.delete(key);
    }
}

/** Forgets one guild, for a caller that has just learned the cached answer is wrong. */
export function forgetGuild(id: string): void {
    guildCache().delete(id);
}

/** Resolves to null when the guild does not exist or the bot is not in it. */
export async function guild(id: string): Promise<GuildSummary | null> {
    const now = Date.now();
    const hit = guildCache().get(id);
    // A cached `null` counts: "the bot is not in this guild" is an answer worth keeping,
    // and it is the one a rail full of unmanaged servers would otherwise re-ask every time.
    if (hit && now - hit.at < GUILD_TTL_MS) return hit.value;

    const { rest, cdn } = client();
    try {
        const found = (await rest.get(Routes.guild(id))) as APIGuild;
        const summary: GuildSummary = {
            id: found.id,
            name: found.name,
            iconUrl: found.icon ? cdn.icon(found.id, found.icon, { size: 128 }) : null,
        };
        remember(id, summary, now);
        return summary;
    }
    catch (err) {
        if (isNotFound(err)) {
            remember(id, null, now);
            return null;
        }
        // A transient failure is not cached: the next request should try again rather
        // than inherit five minutes of an outage.
        logger.warn('Could not fetch guild from Discord', { guild: id, err });
        throw err;
    }
}

function remember(id: string, value: GuildSummary | null, now: number): void {
    pruneGuildCache(now);
    guildCache().set(id, { value, at: now });
}

export interface RoleSummary {
    id: string;
    name: string;
    /** Discord's integer colour, 0 when unset. Rendered as the swatch beside the name. */
    colour: number;
}

/**
 * A guild's roles, so a settings page can name one rather than printing a snowflake.
 *
 * Not memoised like `guild()`: roles are renamed and recoloured far more often than a
 * server is renamed, and this is one call on one page rather than one per tile.
 */
export async function roles(guildId: string): Promise<RoleSummary[]> {
    const { rest } = client();
    try {
        const list = (await rest.get(Routes.guildRoles(guildId))) as APIRole[];
        return list
            // @everyone is a role in the API and never a choice in the UI.
            .filter((r) => r.id !== guildId)
            .map((r) => ({ id: r.id, name: r.name, colour: r.color }));
    }
    catch (err) {
        if (isNotFound(err)) return [];
        logger.warn('Could not fetch roles from Discord', { guild: guildId, err });
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
