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
 * GET /discord-oauth-callback - registered as DISCORD_REDIRECT_URI, so the path is fixed.
 * Exchanges the code, seals the tokens into a cookie, forwards to Nexus Mods.
 */
export async function GET(request: Request): Promise<NextResponse> {
    try {
        const params = new URL(request.url).searchParams;
        const code = params.get('code');
        const discordState = params.get('state');
        const clientState = readSignedCookie(request, CLIENT_STATE_COOKIE);

        // Both halves of the state check, before anything is spent on the request.
        // safeCompare, not ===: the value is client-supplied.
        if (typeof clientState !== 'string' || typeof discordState !== 'string'
            || !safeCompare(clientState, discordState)) {
            logger.warn('Discord OAuth state verification failed.');
            return forbidden();
        }

        // Express sent the literal string "undefined" here and surfaced a [400].
        if (!code) throw new Error('Discord did not return an authorization code.');

        const tokens = await DiscordOAuth.getOAuthTokens(code);
        const meData = await DiscordOAuth.getUserData(tokens);

        const sealed = sealLinkState(
            {
                state: clientState,
                id: meData.user.id,
                // Almost always "name#0" now; kept as Express builds it.
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
