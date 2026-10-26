import type { NextResponse } from 'next/server';
import { exchangeLoginCode, fetchSelf } from '@nexusmods/auth/discordLogin.js';
import { safeCompare } from '@nexusmods/auth/signing.js';
import { logger } from '@nexusmods/core/logger.js';
import { clearSignedCookie, readSignedCookie } from '@/lib/link/cookies';
import { forbidden, redirectTo, redirectToError } from '@/lib/link/flow';
import { LOGIN_STATE_COOKIE } from '@/lib/auth/cookies';
import { setSession } from '@/lib/auth/session';

/**
 * GET /login/callback - registered as DISCORD_LOGIN_REDIRECT_URI, so the path is fixed.
 *
 * Exchanges the code, reads who the user is, and seals a session. It deliberately does
 * NOT read the guild list here: permissions are re-read per request, so fetching them at
 * sign-in would only produce a value that is already stale by the first page.
 */
export async function GET(request: Request): Promise<NextResponse> {
    try {
        const params = new URL(request.url).searchParams;

        // Discord sends ?error=access_denied when the user presses Cancel. Not a failure
        // to shout about, and not a state check worth running.
        if (params.get('error')) return redirectTo('/');

        const code = params.get('code');
        const discordState = params.get('state');
        const loginState = readSignedCookie(request, LOGIN_STATE_COOKIE);

        // safeCompare, not ===: the value is client-supplied.
        if (typeof loginState !== 'string' || typeof discordState !== 'string'
            || !safeCompare(loginState, discordState)) {
            logger.warn('Discord login state verification failed.');
            return forbidden();
        }

        if (!code) throw new Error('Discord did not return an authorization code.');

        const tokens = await exchangeLoginCode(code);
        const self = await fetchSelf(tokens.access_token);

        const response = redirectTo('/me');
        setSession(response, {
            id: self.id,
            name: self.global_name || self.username,
            avatar: self.avatar,
            accessToken: tokens.access_token,
        });
        // The state has done its job; leaving it would be a stale value an attacker could
        // try to replay against a second callback.
        clearSignedCookie(response, LOGIN_STATE_COOKIE);

        logger.info('Signed in', { user: self.id });
        return response;
    }
    catch (err) {
        logger.warn('Discord login error', err);
        return redirectToError('/oauth-error', `Discord login error: ${(err as Error).message}`);
    }
}
