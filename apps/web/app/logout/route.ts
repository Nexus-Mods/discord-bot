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
 *
 * The Origin check stands in for the CSRF token the portal will grow when it can write
 * anything that matters. One header, and it closes the only hole a single-button form has.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const origin = request.headers.get('origin');
    const expected = process.env.SITE_BASE_URL;
    if (origin && expected && new URL(origin).origin !== new URL(expected).origin) {
        logger.warn('Rejected a logout from another origin', { origin });
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
