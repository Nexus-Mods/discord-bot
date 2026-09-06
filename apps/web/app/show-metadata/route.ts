import { NextResponse } from 'next/server';
import { getUserByDiscordId } from '@nexusmods/account/users.js';
import { logger } from '@nexusmods/core/logger.js';
import { cookieAttributes, signCookieValue } from '@/lib/security/signedCookies';
import { json, requireSharedSecret } from '@/lib/machineRoute';

/**
 * GET /show-metadata?id=<discord id> - what Discord currently holds for a linked account.
 *
 * Admin only, because it exposes one person's role-connection metadata, and the guard
 * fails closed.
 *
 * The failure path is Express's, faithfully, and it is odd: an error sets a signed
 * ErrorDetail cookie and redirects to /oauth-error, so an admin running curl against an
 * API gets a 302 to an HTML page about linking accounts. It is reproduced rather than
 * improved because the plan asks these four to answer identically, and because changing it
 * is a decision about an endpoint someone may have scripted - not something to slip into a
 * port. Step 9 is the place to make it a 500 with a message, deliberately.
 *
 * Reproducing it does at least exercise the cookie signing from step 7 against a real
 * response.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const denied = requireSharedSecret(request, 'ADMIN_AUTHCODE');
    if (denied) return denied;

    try {
        const id = new URL(request.url).searchParams.get('id');
        if (!id) throw new Error('ID not sent');

        const user = await getUserByDiscordId(id);
        const meta = user ? await user.Discord.GetRemoteMetaData() : {};
        // Two-space indent, as Express sent it: a human reads this one.
        return json(meta, 200, 2);
    }
    catch (err) {
        logger.warn('Error in show-metadata endpoint', err);
        const response = NextResponse.redirect(new URL('/oauth-error', request.url), 302);
        const secret = process.env.COOKIE_SECRET;
        if (secret) {
            response.cookies.set(
                'ErrorDetail',
                signCookieValue(`Error getting metadata: ${(err as Error).message}`, secret),
                cookieAttributes(1000 * 60 * 2),
            );
        }
        return response;
    }
}
