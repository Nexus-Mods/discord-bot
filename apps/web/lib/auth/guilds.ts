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
 * Wrapped in React's `cache`, so the manage layout and the page inside it resolve one
 * list between them rather than asking Discord twice for the same request. It is a
 * per-request cache, not a store - permissions are still read live on every navigation,
 * which is the rule the plan sets out.
 */

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

    let candidates: GuildAccess[];
    try {
        candidates = manageable(await fetchUserGuilds(session.accessToken));
    }
    catch (err) {
        // An expired or revoked token lands here, as does Discord being down.
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

    return { guilds: resolved.filter((g): g is ManageableGuild => g !== null), failed: false };
});

/**
 * One guild, if this visitor may manage something in it.
 *
 * Null covers three different situations deliberately: no such guild, the bot is not in
 * it, and the visitor holds neither permission there. A page that distinguished them
 * would tell an outsider which servers this bot is in.
 */
export async function guildAccess(guildId: string): Promise<ManageableGuild | null> {
    const { guilds } = await manageableGuilds();
    return guilds.find((g) => g.id === guildId) ?? null;
}
