'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { deleteUser } from '@nexusmods/account/users.js';
import { logger } from '@nexusmods/core/logger.js';
import { verifyUnlinkRequest } from '@/lib/link/unlink';
import { ERROR_DETAIL_COOKIE, ERROR_DETAIL_TTL_MS } from '@/lib/link/cookies';
import { cookieAttributes, signCookieValue } from '@/lib/security/signedCookies';

/**
 * Removing the account link.
 *
 * A server action, not a route handler: Next will not serve a route.ts and a page.tsx in
 * the same segment, and /revoke has to be both. This keeps the URL and method the browser
 * sees identical, works with scripting disabled, and adds Next's Origin check on top of
 * the signed token that actually secures it.
 */
export async function revokeAccountLink(formData: FormData): Promise<void> {
    const id = String(formData.get('id') ?? '');
    const token = String(formData.get('token') ?? '');

    try {
        // Verified again: the page's check is for what is shown, this for what is deleted.
        const user = await verifyUnlinkRequest(id, token);

        // Tokens first, row second: deleting first would orphan live tokens.
        await user.Discord.Revoke();
        await user.NexusMods.Revoke();
        await deleteUser(id);

        logger.info('Revoke successful for user', user.NexusModsUsername);
    }
    catch (err) {
        logger.warn('Error removing account link', err);
        const secret = process.env.COOKIE_SECRET;
        if (secret) {
            // An action may set cookies; a page may not.
            (await cookies()).set(
                ERROR_DETAIL_COOKIE,
                signCookieValue(`Error unlinking accounts: ${(err as Error).message}`, secret),
                cookieAttributes(ERROR_DETAIL_TTL_MS),
            );
        }
        redirect('/unlink-error');
    }

    // Outside the try: `redirect` throws, and the catch above would swallow it. Redirecting
    // rather than rendering also stops a refresh re-submitting the unlink.
    redirect('/revoked');
}
