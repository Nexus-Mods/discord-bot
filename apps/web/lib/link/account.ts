import * as NexusModsOAuth from '@nexusmods/auth/NexusModsOAuth.js';
import type { LinkState } from '@nexusmods/auth/linkState.js';
import { baseheader } from '@nexusmods/nexus-api/headers.js';
import { createUser, deleteUser, getUserByDiscordId, getUserByNexusModsId, updateUser } from '@nexusmods/account/users.js';
import type { NexusUser } from '@nexusmods/persistence/types/users.js';
import type { Logger } from '@nexusmods/core/logger.js';
import { updateDiscordMetadata } from '@/lib/discordMetadata';

/**
 * Writing the account link, ported from the body of AuthSite.nexusModsOauthCallback.
 *
 * Split out from the route for the reason the automod rules were: the route is about
 * HTTP - state checks, cookies, redirects - and this is about an account. It is also the
 * only code in the web app that writes a user row, so it is worth being able to find.
 *
 * Sequence matters here and is preserved exactly:
 *
 *   1. look up the Discord id we already hold a link for
 *   2. exchange the code (this can fail, and must fail before anything is written)
 *   3. fetch the Nexus Mods profile
 *   4. if this Discord account is new to us but the Nexus Mods account is not, revoke and
 *      delete the *other* link first
 *   5. write the row
 *   6. push linked-role metadata
 *
 * Step 4 is the one that looks wrong and is not. A Nexus Mods account may only be linked
 * to one Discord account, so linking it to a second one has to remove the first, and the
 * removal happens before the write so the unique constraint the database holds is never
 * the thing that reports the conflict.
 */

/** What the success page needs. Returned rather than redirected to, so the route owns the HTTP. */
export interface LinkResult {
    nexus: string;
    n_id: string;
    discord: string;
    d_id: string;
}

export async function completeLink(discord: LinkState, code: string, logger: Logger): Promise<LinkResult> {
    const existingUser = await getUserByDiscordId(discord.id);

    const tokens = await NexusModsOAuth.getOAuthTokens(code);
    // baseheader carries the application name and version to the Nexus Mods API, which
    // getUserData needs for the mod-author lookup.
    const userData = await NexusModsOAuth.getUserData(tokens, logger, { ...baseheader });

    if (!existingUser) {
        const nexusUser = await getUserByNexusModsId(parseInt(userData.sub));
        if (nexusUser) {
            logger.info('Deleting link to a different Discord account!', {
                user: nexusUser.NexusModsUsername, discord: nexusUser.DiscordId,
            });
            try {
                await nexusUser.Discord.Revoke();
                await nexusUser.NexusMods.Revoke();
            }
            catch (err) {
                // Revoking the old tokens is best-effort: the link is being removed either
                // way, and a Discord or Nexus Mods outage must not block the new one.
                logger.warn('Error revoking tokens for alternate account', err);
            }
            await deleteUser(nexusUser.DiscordId);
        }
    }

    /**
     * `supporter` is deliberately "supporter and not premium".
     *
     * Premium implies supporter on the Nexus Mods side, and the linked-role metadata has
     * separate booleans for the two - so without the exclusion a premium member matches a
     * "supporter" role as well, which is not what a server owner granting one or the other
     * means by it.
     */
    const user: Partial<NexusUser> = {
        id: parseInt(userData.sub),
        name: userData.name,
        avatar_url: userData.avatar,
        supporter: userData.membership_roles.includes('supporter') && !userData.membership_roles.includes('premium'),
        premium: userData.membership_roles.includes('premium'),
        modauthor: userData.membership_roles.includes('modauthor'),
        nexus_access: tokens.access_token,
        nexus_refresh: tokens.refresh_token,
        nexus_expires: tokens.expires_at,
        discord_access: discord.tokens.access_token,
        discord_refresh: discord.tokens.refresh_token,
        discord_expires: discord.tokens.expires_at,
    };

    // A row with no access token is a link that cannot be refreshed, which fails later and
    // much less clearly. Checked before the write, as Express does.
    if (!user.nexus_access) throw new Error('No Token in new user data!');

    const updatedUser = existingUser
        ? await updateUser(discord.id, user)
        : await createUser({ d_id: discord.id, ...user } as NexusUser);

    // The already-fetched user is handed over so this does not re-read the row it wrote.
    await updateDiscordMetadata(discord.id, logger, updatedUser);

    logger.info('OAuth Account link success', { discord: discord.name, nexusMods: user.name });

    return {
        nexus: user.name ?? '',
        n_id: user.id?.toString() ?? '0',
        discord: discord.name,
        d_id: discord.id,
    };
}
