import { NextResponse } from 'next/server';
import { ERROR_DETAIL_COOKIE, ERROR_DETAIL_TTL_MS, setSignedCookie } from '@/lib/link/cookies';

/**
 * The redirects the OAuth flow is made of.
 *
 * `NextResponse.redirect` needs an absolute URL and the only one a route handler has is
 * `request.url`, which behind a reverse proxy is the internal address - so a redirect
 * built that way can hand the browser `http://localhost:3000/oauth-error`. Express sent
 * the path it was given and let the browser resolve it against the address it actually
 * used, which is both correct and proxy-agnostic; RFC 7231 has allowed a relative Location
 * since 2014.
 *
 * So: relative for our own pages, absolute for Discord and Nexus Mods, one function for
 * both, because the value being redirected to is sometimes one and sometimes the other -
 * `getOAuthUrl` returns the string '/oauth-error' when its environment is not configured.
 */
export function redirectTo(location: string): NextResponse {
    // 302, matching res.redirect's default. Not 303: a GET is being redirected to a GET,
    // and 302 is what any client of these URLs has been getting.
    return new NextResponse(null, { status: 302, headers: { Location: location } });
}

/**
 * Redirect to an error page, carrying the reason in a signed cookie.
 *
 * The cookie, not the query string. The two error pages were ported in step 6 reading
 * `?error=`, which was fine for pages with nothing behind them and is not fine now that
 * they are the failure path of a real flow: a query parameter is attacker-supplied, so
 * anyone could hand out a discordbot.nexusmods.com link that renders text of their
 * choosing in the error box of a genuine Nexus Mods page. A signed cookie can only have
 * been set by this server, which is why Express used one - and why both pages say "Are you
 * blocking cookies?" when there is nothing to show.
 */
export function redirectToError(path: '/oauth-error' | '/unlink-error', message: string): NextResponse {
    const response = redirectTo(path);
    setSignedCookie(response, ERROR_DETAIL_COOKIE, message, ERROR_DETAIL_TTL_MS);
    return response;
}

/**
 * `res.sendStatus(403)` - an empty body, no page, no explanation.
 *
 * Used when the OAuth state does not match, which is either a stale tab or someone
 * feeding a callback URL to a victim. Neither gets told which.
 */
export function forbidden(): NextResponse {
    return new NextResponse(null, { status: 403 });
}
