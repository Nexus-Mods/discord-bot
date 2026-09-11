import { verifyValue } from '@nexusmods/auth/signing.js';
import type { DiscordBotUser } from '@nexusmods/account/DiscordBotUser.js';
import { getUserByDiscordId } from '@nexusmods/account/users.js';

/**
 * The check both halves of the unlink flow make.
 *
 * There is no session here: a correctly signed link for a given id, valid 24 hours, IS the
 * authorisation. The confirm page runs this too, not just the submit - a page that will
 * print any two names on request can tell somebody their account is about to be unlinked
 * when it is not.
 *
 * The messages reach the user, in the error box on the page.
 */
export async function verifyUnlinkRequest(id: string, token: string): Promise<DiscordBotUser> {
    if (!id) throw new Error('Discord ID parameter was not supplied.');

    const secret = process.env.UNLINK_SECRET;
    // Fails closed: with no secret configured, no link can be honoured.
    if (!secret) throw new Error('Unlinking is not configured on this server.');

    if (!verifyValue(id, token, secret)) {
        throw new Error('This unlink link is invalid or has expired. Run /unlink in Discord to get a new one.');
    }

    const user = await getUserByDiscordId(id);
    if (!user) throw new Error('No account link exists for this Discord account.');
    return user;
}
