import type { NextResponse } from 'next/server';
import * as DiscordOAuth from '@nexusmods/auth/DiscordOAuth.js';
import { CLIENT_STATE_COOKIE, CLIENT_STATE_TTL_MS, setSignedCookie } from '@/lib/link/cookies';
import { redirectTo } from '@/lib/link/flow';

/**
 * GET /linked-role - where an account link begins.
 *
 * This is the URL configured as the "Linked Roles Verification URL" in Discord's developer
 * portal, so the path is not ours to choose. It mints an OAuth state, remembers it in a
 * signed cookie, and sends the user to Discord.
 *
 * The state is the whole security property of the next two steps: Discord echoes it back
 * on the callback, and the callback only proceeds if the echo matches the cookie. Without
 * it, an attacker can complete a link they started using a victim's browser session.
 * https://discord.com/developers/docs/topics/oauth2#state-and-security
 *
 * No shared-secret guard, because there is nobody to authenticate yet - that is what this
 * endpoint exists to arrange. It is rate limited as a sensitive path in proxy.ts, which is
 * where Express's `sensitiveLimit` on this route went.
 */
export async function GET(): Promise<NextResponse> {
    const { url, state } = DiscordOAuth.getOAuthUrl();

    // getOAuthUrl returns the string '/oauth-error' rather than throwing when
    // DISCORD_CLIENT_ID or DISCORD_REDIRECT_URI is missing. Passed through as-is: an
    // unconfigured deployment sends the user to the error page, exactly as before.
    const response = redirectTo(url);

    // Five minutes - long enough to read Discord's consent screen, short enough that an
    // abandoned attempt cannot be resumed later.
    setSignedCookie(response, CLIENT_STATE_COOKIE, state, CLIENT_STATE_TTL_MS);
    return response;
}
