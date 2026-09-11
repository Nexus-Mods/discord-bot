import type { NextResponse } from 'next/server';
import { openLinkState } from '@nexusmods/auth/linkState.js';
import { safeCompare } from '@nexusmods/auth/signing.js';
import { logger } from '@nexusmods/core/logger.js';
import { completeLink } from '@/lib/link/account';
import { CLIENT_STATE_COOKIE, LINK_STATE_COOKIE, clearSignedCookie, readSignedCookie } from '@/lib/link/cookies';
import { forbidden, redirectTo, redirectToError } from '@/lib/link/flow';

/**
 * GET /nexus-mods-callback - registered as NEXUS_REDIRECT_URI, and the only place a user
 * row is written. Three checks stand in front of that, all on the request itself: the
 * OAuth state matches the signed cookie, the sealed cookie opens with that state, and the
 * sealed payload has not expired.
 *
 * The sealed cookie holds live Discord tokens and is cleared on EVERY path out of here,
 * which is why every return goes through `done()`.
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

    // The state is passed in so a cookie captured from one attempt cannot finish another.
    const discordData = openLinkState(
        readSignedCookie(request, LINK_STATE_COOKIE),
        process.env.COOKIE_SECRET!,
        clientState,
    );

    if (!discordData) {
        // The path, not the URL: the query string carries an authorization code.
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
