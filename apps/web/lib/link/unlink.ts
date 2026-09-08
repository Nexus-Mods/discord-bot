import { verifyValue } from '@nexusmods/auth/signing.js';
import type { DiscordBotUser } from '@nexusmods/account/DiscordBotUser.js';
import { getUserByDiscordId } from '@nexusmods/account/users.js';

/**
 * The check both halves of the unlink flow make, ported from
 * AuthSite.verifyRevokeRequest.
 *
 * The link handed to a user by /unlink in Discord carries their Discord id and an HMAC
 * over it, valid for 24 hours. That signature is the entire authorisation: there is no
 * session here, so possession of a correctly signed link for a given id is what proves the
 * request came from someone the bot sent it to.
 *
 * Which is why the confirm page has to run this too, not just the submit. Step 6 ported
 * the page reading `nexusName` and `discordName` out of the query string, so the page
 * would render whatever names the URL claimed, for any id, with no signature involved. The
 * unlink itself was safe - Express's POST verifies - but the page is what a user reads
 * before deciding, and a page that will print any two names on request is a page that can
 * be used to tell somebody their own account is about to be unlinked when it is not.
 *
 * The messages are deliberately the ones Express shows the user, because they end up in
 * the error box on the page.
 */
export async function verifyUnlinkRequest(id: string, token: string): Promise<DiscordBotUser> {
    if (!id) throw new Error('Discord ID parameter was not supplied.');

    const secret = process.env.UNLINK_SECRET;
    // Fails closed: with no secret configured, no link can be honoured. bootCheck refuses
    // to start without it, so this is the second line rather than the first.
    if (!secret) throw new Error('Unlinking is not configured on this server.');

    if (!verifyValue(id, token, secret)) {
        throw new Error('This unlink link is invalid or has expired. Run /unlink in Discord to get a new one.');
    }

    const user = await getUserByDiscordId(id);
    if (!user) throw new Error('No account link exists for this Discord account.');
    return user;
}
