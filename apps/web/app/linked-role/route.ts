import type { NextResponse } from 'next/server';
import * as DiscordOAuth from '@nexusmods/auth/DiscordOAuth.js';
import { CLIENT_STATE_COOKIE, CLIENT_STATE_TTL_MS, setSignedCookie } from '@/lib/link/cookies';
import { redirectTo } from '@/lib/link/flow';

/**
 * GET /linked-role - where an account link begins. Registered as the Linked Roles
 * Verification URL in Discord's developer portal, so the path is fixed.
 *
 * The state it mints is the security property of the next two steps: Discord echoes it
 * back and the callback only proceeds if the echo matches the signed cookie.
 */
export async function GET(): Promise<NextResponse> {
    const { url, state } = DiscordOAuth.getOAuthUrl();

    // getOAuthUrl returns '/oauth-error' rather than throwing when unconfigured.
    const response = redirectTo(url);

    setSignedCookie(response, CLIENT_STATE_COOKIE, state, CLIENT_STATE_TTL_MS);
    return response;
}
