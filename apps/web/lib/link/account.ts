import * as NexusModsOAuth from '@nexusmods/auth/NexusModsOAuth.js';
import type { LinkState } from '@nexusmods/auth/linkState.js';
import { baseheader } from '@nexusmods/nexus-api/headers.js';
import { createUser, deleteUser, getUserByDiscordId, getUserByNexusModsId, updateUser } from '@nexusmods/account/users.js';
import type { NexusUser } from '@nexusmods/persistence/types/users.js';
import type { Logger } from '@nexusmods/core/logger.js';
import { updateDiscordMetadata } from '@/lib/discordMetadata';

/**
 * Writing the account link - the only code in the web app that writes a user row.
 *
 * The order matters: the code exchange must fail before anything is written, and an
 * existing link on the same Nexus Mods account is revoked and deleted BEFORE the write, so
 * the database's unique constraint is never what reports the conflict.
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
    // baseheader carries the application name and version for the mod-author lookup.
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
                // Best-effort: an outage must not block the new link.
                logger.warn('Error revoking tokens for alternate account', err);
            }
            await deleteUser(nexusUser.DiscordId);
        }
    }

    /**
     * `supporter` is "supporter and NOT premium": premium implies supporter upstream, and
     * the linked-role metadata has separate booleans for the two.
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

    // A row with no access token is a link that cannot be refreshed.
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
