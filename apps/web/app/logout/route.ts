import { NextResponse } from 'next/server';
import { revokeLoginToken } from '@nexusmods/auth/discordLogin.js';
import { logger } from '@nexusmods/core/logger.js';
import { clearSession, sessionFrom } from '@/lib/auth/session';

/**
 * POST /logout.
 *
 * POST, not GET: a GET would let any page on the internet sign a visitor out with an
 * `<img src="https://.../logout">`. Harmless as mischief goes, but this is the first
 * state-changing route on the site and it may as well establish the shape the rest will
 * need.
 */

/** Our own origin, from configuration. Null when SITE_BASE_URL is absent or malformed. */
function expectedOrigin(): string | null {
    const base = process.env.SITE_BASE_URL;
    if (!base) return null;
    try {
        return new URL(base).origin;
    }
    catch {
        logger.warn('SITE_BASE_URL is not a URL, so the logout origin check cannot run.');
        return null;
    }
}

/**
 * Whether this request came from our own page.
 *
 * `Sec-Fetch-Site` first, because it is the header designed for this question and every
 * current browser sends it. Origin alone is not enough: a form submitted from a context
 * with an opaque origin - a sandboxed frame, a `file://` page, some redirect chains -
 * sends the literal string `null`, which is same-origin as far as the user is concerned
 * and unparseable as far as `new URL` is concerned. An earlier version passed it to
 * `new URL()` and answered a sign-out with a 500.
 *
 * Nothing here parses the header. The untrusted value is compared as a string against one
 * origin we built ourselves.
 */
function sameOrigin(request: Request): boolean {
    const site = request.headers.get('sec-fetch-site');
    if (site) return site === 'same-origin';

    const origin = request.headers.get('origin');
    // No Origin at all: some legitimate same-origin posts omit it, and a browser that
    // sends neither header is old enough that CSRF is not the threat model it needs.
    if (!origin) return true;

    const expected = expectedOrigin();
    return expected === null || origin === expected;
}

export async function POST(request: Request): Promise<NextResponse> {
    if (!sameOrigin(request)) {
        logger.warn('Rejected a logout from another origin', {
            origin: request.headers.get('origin'),
            site: request.headers.get('sec-fetch-site'),
        });
        return new NextResponse(null, { status: 403 });
    }

    const session = sessionFrom(request);

    // 303, so the browser follows with a GET. A 302 after a POST is a re-POST in some
    // clients.
    const response = new NextResponse(null, { status: 303, headers: { Location: '/' } });
    clearSession(response);

    if (session) {
        // Best effort: the cookie is already gone, and a failed revoke must not turn a
        // sign-out into an error page.
        try {
            await revokeLoginToken(session.accessToken);
        }
        catch (err) {
            logger.warn('Could not revoke the Discord token on sign-out', err);
        }
        logger.info('Signed out', { user: session.id });
    }

    return response;
}
