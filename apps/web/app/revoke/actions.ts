'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { deleteUser } from '@nexusmods/account/users.js';
import { logger } from '@nexusmods/core/logger.js';
import { verifyUnlinkRequest } from '@/lib/link/unlink';
import { ERROR_DETAIL_COOKIE, ERROR_DETAIL_TTL_MS } from '@/lib/link/cookies';
import { cookieAttributes, signCookieValue } from '@/lib/security/signedCookies';

/**
 * Removing the account link, ported from AuthSite.revokeAccess.
 *
 * A server action rather than a route handler, for one reason that decided it: Next
 * refuses to serve a `route.ts` and a `page.tsx` in the same segment, and /revoke has to
 * be both - a page on GET and the submit target on POST, exactly as Express registers it.
 * An action keeps the URL and the method the user's browser sees identical to today's,
 * with the two hidden fields still in the body.
 *
 * It also comes with an Origin check: Next rejects an action POST whose Origin does not
 * match the Host. That is not what secures this endpoint - the signed token in the body is,
 * and it is a capability only the person who ran /unlink in Discord has - but a form that
 * deletes an account link is a reasonable thing to want two locks on.
 *
 * This form works with scripting disabled: Next renders a real form with a hidden action
 * id and posts it.
 */
export async function revokeAccountLink(formData: FormData): Promise<void> {
    const id = String(formData.get('id') ?? '');
    const token = String(formData.get('token') ?? '');

    try {
        // Verified again here, not trusted from the page that rendered the form. The page's
        // check is for what the user is shown; this one is for what is deleted.
        const user = await verifyUnlinkRequest(id, token);

        // Tokens first, row second. If revoking throws, the row survives and the user can
        // try again - deleting first would leave live Discord and Nexus Mods tokens with
        // nothing left in the database pointing at them to revoke later.
        await user.Discord.Revoke();
        await user.NexusMods.Revoke();
        await deleteUser(id);

        logger.info('Revoke successful for user', user.NexusModsUsername);
    }
    catch (err) {
        logger.warn('Error removing account link', err);
        const secret = process.env.COOKIE_SECRET;
        if (secret) {
            // An action may set cookies; a page may not. This is why the failure path here
            // can keep Express's shape and /revoke's own cannot.
            (await cookies()).set(
                ERROR_DETAIL_COOKIE,
                signCookieValue(`Error unlinking accounts: ${(err as Error).message}`, secret),
                cookieAttributes(ERROR_DETAIL_TTL_MS),
            );
        }
        redirect('/unlink-error');
    }

    /**
     * Outside the try, because `redirect` works by throwing: inside, the catch above would
     * swallow it, set an ErrorDetail cookie reading "NEXT_REDIRECT" and send a user whose
     * unlink had just succeeded to the error page.
     *
     * Express rendered the success view straight from the POST, so a refresh re-submitted
     * the unlink. Redirecting to a page with its own URL fixes that: the second request is
     * a GET of /revoked.
     */
    redirect('/revoked');
}
