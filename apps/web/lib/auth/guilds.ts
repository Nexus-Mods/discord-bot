import { cache } from 'react';
import { fetchUserGuilds } from '@nexusmods/auth/discordLogin.js';
import { logger } from '@nexusmods/core/logger.js';
import { currentSession } from '@/lib/auth/session';
import { manageable } from '@/lib/auth/permissions';
import type { GuildAccess } from '@/lib/auth/permissions';
import { guild as botGuild } from '@/lib/discordDirectory';

/**
 * The servers this visitor can manage here: the ones where they hold a permission the
 * portal cares about AND this bot is present.
 *
 * Wrapped in React's `cache` so the layout and the page inside it resolve one list
 * between them, and behind a short per-user cache so that navigating does not spend a
 * request to Discord every time.
 *
 * That second cache is a correctness fix, not an optimisation. GET /users/@me/guilds is
 * rate limited to roughly one request per second per user. A rail of five servers
 * prefetched five routes the moment it rendered, each asking Discord for the same list;
 * all but the first came back 429, which this code read as "no access" and turned into a
 * 404 behind every tile.
 */

/** Long enough to survive a burst of navigation, short enough that losing access bites. */
const GUILD_LIST_TTL_MS = 60 * 1000;
const LIST_CACHE = Symbol.for('@nexusmods/discord-web.guildListCache');

interface CachedList { value: ManageableGuilds; at: number }
interface ListHost { [LIST_CACHE]?: Map<string, CachedList> }

function listCache(): Map<string, CachedList> {
    const host = globalThis as ListHost;
    host[LIST_CACHE] ??= new Map();
    return host[LIST_CACHE];
}

/** Forgets one user's list - for a sign-out, or a caller that knows it is stale. */
export function forgetGuildList(userId: string): void {
    listCache().delete(userId);
}

export interface ManageableGuild extends GuildAccess {
    /** From the bot's own view of the guild, so it is the icon the bot can actually see. */
    iconUrl: string | null;
}

export interface ManageableGuilds {
    guilds: ManageableGuild[];
    /**
     * Discord could not be reached. Distinct from an empty list, which is a fact about
     * the user; this is a fact about the weather, and the two read very differently.
     */
    failed: boolean;
}

/**
 * Only the guilds the user can manage are checked against the bot. Listing every guild
 * the bot is in and intersecting would be thirteen paginated calls for 2,400 servers;
 * filtering by permission first usually leaves a handful.
 */
export const manageableGuilds = cache(async (): Promise<ManageableGuilds> => {
    let session;
    try {
        session = await currentSession();
    }
    catch {
        // An unreadable cookie is signed out, not an error worth a page.
        return { guilds: [], failed: false };
    }
    if (!session) return { guilds: [], failed: false };

    const now = Date.now();
    const hit = listCache().get(session.id);
    // Only a successful list is cached: a failure should be retried on the next
    // navigation, not inherited for a minute.
    if (hit && now - hit.at < GUILD_LIST_TTL_MS) return hit.value;

    let candidates: GuildAccess[];
    try {
        candidates = manageable(await fetchUserGuilds(session.accessToken));
    }
    catch (err) {
        // An expired or revoked token lands here, as does Discord being down or rate
        // limiting us.
        logger.warn('Could not read the guild list', err);
        return { guilds: [], failed: true };
    }

    const resolved = await Promise.all(candidates.map(async (g): Promise<ManageableGuild | null> => {
        try {
            const present = await botGuild(g.id);
            return present ? { ...g, iconUrl: present.iconUrl } : null;
        }
        catch (err) {
            // One unreachable guild must not empty the whole rail.
            logger.warn('Could not check whether the bot is in a guild', { guild: g.id, err });
            return null;
        }
    }));

    const value: ManageableGuilds = {
        guilds: resolved.filter((g): g is ManageableGuild => g !== null),
        failed: false,
    };
    listCache().set(session.id, { value, at: now });
    return value;
});

/**
 * One guild, if this visitor may manage something in it.
 *
 * Null covers three different situations deliberately: no such guild, the bot is not in
 * it, and the visitor holds neither permission there. A page that distinguished them
 * would tell an outsider which servers this bot is in.
 */
export interface GuildLookup {
    guild: ManageableGuild | null;
    /**
     * Discord could not be asked. Reported separately because a null guild means "not
     * yours", and a caller treating the two alike answers a rate limit with a 404 - which
     * is what it used to do.
     */
    unavailable: boolean;
}

export async function guildAccess(guildId: string): Promise<GuildLookup> {
    const { guilds, failed } = await manageableGuilds();
    if (failed) return { guild: null, unavailable: true };
    return { guild: guilds.find((g) => g.id === guildId) ?? null, unavailable: false };
}
