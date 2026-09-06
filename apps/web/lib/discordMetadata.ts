import type { DiscordBotUser } from '@nexusmods/account/DiscordBotUser.js';
import { getUserByDiscordId } from '@nexusmods/account/users.js';
import type { Logger } from '@nexusmods/core/logger.js';

/**
 * Push a user's linked-role metadata back to Discord.
 *
 * Ported from AuthSite.updateDiscordMetadata, including the part that looks like a
 * mistake and is not: the token refresh and the metadata build are wrapped in a try that
 * only *logs* a failure, and the push happens anyway. That means a user whose Nexus Mods
 * token has gone bad gets an empty metadata object pushed, which clears their linked
 * roles - which is the correct outcome, because the roles claim things about an account
 * the bot can no longer verify.
 *
 * Kept as its own function rather than inlined into the route because it is called from
 * two places in the Express version - the /update-metadata endpoint and the end of the
 * account link - and the second of those arrives here at step 9.
 */
export async function updateDiscordMetadata(
    userId: string,
    logger: Logger,
    known?: DiscordBotUser,
): Promise<void> {
    const user = known ?? await getUserByDiscordId(userId);
    if (!user) throw new Error('No linked users for this Discord ID.');

    let metadata = {};
    try {
        await user.NexusMods.Auth();
        await user.NexusMods.Refresh();
        metadata = await user.Discord.BuildMetaData();
    }
    catch (err) {
        logger.warn(`Error updating role metadata: [[${(err as Error).message}]]`, err);
    }

    await user.Discord.PushMetaData(metadata);
}
