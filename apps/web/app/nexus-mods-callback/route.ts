import type { NextResponse } from 'next/server';
import { openLinkState } from '@nexusmods/auth/linkState.js';
import { safeCompare } from '@nexusmods/auth/signing.js';
import { logger } from '@nexusmods/core/logger.js';
import { completeLink } from '@/lib/link/account';
import { CLIENT_STATE_COOKIE, LINK_STATE_COOKIE, clearSignedCookie, readSignedCookie } from '@/lib/link/cookies';
import { forbidden, redirectTo, redirectToError } from '@/lib/link/flow';

/**
 * GET /nexus-mods-callback - the second half of the link, and the only place a user row
 * is written.
 *
 * Registered as NEXUS_REDIRECT_URI with Nexus Mods, so the path is fixed.
 *
 * Three checks stand between a request and the account write, and all three are on the
 * request rather than on anything the server remembers:
 *
 *   - the OAuth state must match the signed clientState cookie
 *   - the sealed linkState cookie must open with that same state
 *   - the sealed payload must not have expired (five minutes, inside the ciphertext)
 *
 * The sealed cookie is cleared on every path out of here, success or failure. Express does
 * this immediately after reading it, and the reason is that it holds live Discord access
 * and refresh tokens: a failed attempt that leaves them in the browser leaves them there
 * for the rest of their window. Next has no `res` to write to before the work happens, so
 * the clear is applied to the response instead - which is why every return goes through
 * `done()`.
 */
export async function GET(request: Request): Promise<NextResponse> {
    /** Clear the sealed link state on the way out, whatever the outcome. */
    const done = (response: NextResponse): NextResponse => {
        clearSignedCookie(response, LINK_STATE_COOKIE);
        return response;
    };

    const params = new URL(request.url).searchParams;
    const code = params.get('code');
    const nexusState = params.get('state');
    const clientState = readSignedCookie(request, CLIENT_STATE_COOKIE);

    if (typeof clientState !== 'string' || typeof nexusState !== 'string'
        || !safeCompare(clientState, nexusState)) {
        logger.warn('Nexus Mods OAuth state verification failed.');
        return done(forbidden());
    }

    /**
     * openLinkState returns null for every failure - forged, expired, wrong secret, or
     * belonging to a different flow - because none of them is recoverable and telling them
     * apart here would only invite treating a forged cookie as a transient error.
     *
     * The state is passed in so a cookie captured from one link attempt cannot finish
     * another: the payload carries the state it was sealed with and is checked against
     * this request's.
     */
    const discordData = openLinkState(
        readSignedCookie(request, LINK_STATE_COOKIE),
        process.env.COOKIE_SECRET!,
        clientState,
    );

    if (!discordData) {
        // The path, not the full URL: this is logged, and the query string carries an
        // authorization code.
        logger.warn('Could not find matching Discord Auth to pair accounts', new URL(request.url).pathname);
        return done(forbidden());
    }

    try {
        if (!code) throw new Error('Nexus Mods did not return an authorization code.');

        const result = await completeLink(discordData, code, logger);
        const query = new URLSearchParams(result as unknown as Record<string, string>);
        return done(redirectTo(`/success?${query.toString()}`));
    }
    catch (err) {
        logger.warn('Nexus Mods OAuth Error', err);
        return done(redirectToError('/oauth-error', `Nexus Mods OAuth Error: ${(err as Error).message || err}`));
    }
}
