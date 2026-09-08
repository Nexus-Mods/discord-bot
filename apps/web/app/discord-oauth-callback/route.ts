import type { NextResponse } from 'next/server';
import * as DiscordOAuth from '@nexusmods/auth/DiscordOAuth.js';
import * as NexusModsOAuth from '@nexusmods/auth/NexusModsOAuth.js';
import { LINK_STATE_TTL_MS, sealLinkState } from '@nexusmods/auth/linkState.js';
import { logger } from '@nexusmods/core/logger.js';
import { safeCompare } from '@nexusmods/auth/signing.js';
import {
    CLIENT_STATE_COOKIE, LINK_STATE_COOKIE, readSignedCookie, setSignedCookie,
} from '@/lib/link/cookies';
import { forbidden, redirectTo, redirectToError } from '@/lib/link/flow';

/**
 * GET /discord-oauth-callback - Discord hands back an authorization code.
 *
 * Registered as DISCORD_REDIRECT_URI in the developer portal, so this path is fixed. It
 * exchanges the code for tokens, seals them into a cookie, and forwards the user to Nexus
 * Mods for the second half of the link.
 *
 * The tokens go in a cookie rather than in server memory because the link spans two OAuth
 * round trips and the server holds no state between them - see linkState.ts for why that
 * is worth a sealed cookie. The practical effect is that a deploy in the middle of
 * somebody's link no longer drops them into a 403.
 */
export async function GET(request: Request): Promise<NextResponse> {
    try {
        const params = new URL(request.url).searchParams;
        const code = params.get('code');
        const discordState = params.get('state');
        const clientState = readSignedCookie(request, CLIENT_STATE_COOKIE);

        /**
         * Both halves of the state check, before anything is spent on the request.
         *
         * `safeCompare` rather than `===` for the same reason Express uses it: the
         * comparison is against a value the client supplies, and a timing signal on a
         * 36-character UUID is a real, if slow, oracle. It also returns false on a length
         * mismatch, so no length is leaked either.
         */
        if (typeof clientState !== 'string' || typeof discordState !== 'string'
            || !safeCompare(clientState, discordState)) {
            logger.warn('Discord OAuth state verification failed.');
            return forbidden();
        }

        /**
         * Express passed `req.query['code'] as string` straight through, so a callback
         * with no code sent the literal string "undefined" to Discord's token endpoint and
         * surfaced as "[400] Bad Request" in the error box. Checked here instead: same
         * destination, a message that says what happened.
         */
        if (!code) throw new Error('Discord did not return an authorization code.');

        const tokens = await DiscordOAuth.getOAuthTokens(code);
        const meData = await DiscordOAuth.getUserData(tokens);

        const sealed = sealLinkState(
            {
                state: clientState,
                id: meData.user.id,
                // Discord retired discriminators, so this is now almost always "name#0".
                // Left exactly as Express builds it: the success page prints it, and
                // changing the format inside a port makes the two versions incomparable.
                name: `${meData.user.username}#${meData.user.discriminator}`,
                tokens,
            },
            process.env.COOKIE_SECRET!,
        );

        const { url } = NexusModsOAuth.getOAuthUrl(clientState, logger);
        const response = redirectTo(url);
        setSignedCookie(response, LINK_STATE_COOKIE, sealed, LINK_STATE_TTL_MS);
        return response;
    }
    catch (err) {
        logger.warn('Discord OAuth Error', err);
        return redirectToError('/oauth-error', `Discord OAuth Error: ${(err as Error).message}`);
    }
}
