import type { NextResponse } from 'next/server';
import { getLoginUrl, isLoginConfigured, newState } from '@nexusmods/auth/discordLogin.js';
import { CLIENT_STATE_TTL_MS, setSignedCookie } from '@/lib/link/cookies';
import { redirectTo, redirectToError } from '@/lib/link/flow';
import { LOGIN_STATE_COOKIE } from '@/lib/auth/cookies';

/**
 * GET /login - where signing in begins.
 *
 * Its own state cookie, not the link flow's `clientState`. Two flows sharing one cookie
 * name means a login started in one tab can be completed by a link callback in another,
 * which is the exact confusion the state parameter exists to prevent.
 */
export async function GET(): Promise<NextResponse> {
    if (!isLoginConfigured()) {
        return redirectToError('/oauth-error', 'Signing in is not available on this site yet.');
    }

    const state = newState();
    const response = redirectTo(getLoginUrl(state));
    setSignedCookie(response, LOGIN_STATE_COOKIE, state, CLIENT_STATE_TTL_MS);
    return response;
}
