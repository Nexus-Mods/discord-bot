import { NextResponse } from 'next/server';
import { logger } from '@nexusmods/core/logger.js';
import { WEBHOOK_MAX_BYTES, readJsonWithLimit } from '@/lib/security/bodyLimit';
import { handleForumEvent } from '@/lib/forum/webhook';

/**
 * POST /webhook - Invision posts here when a forum topic or reply is created.
 *
 * The one endpoint in this application that takes a large POST from a caller it cannot
 * authenticate. Invision offers no shared secret, no HMAC and no IP setting, so anyone who
 * learns the URL can post to it - which is why the 5MB cap is enforced by reading and
 * counting rather than configured on a parser that has already been handed the request.
 *
 * The plan's note stands and gets worse at step 9: after the cutover this lives in the
 * same deployment as the public site. The two mitigations that need nothing from Invision
 * are a secret in the URL path and an inbound IP allow-list on the droplet.
 *
 * It answers 200 before doing the work, exactly as the Express version does. Invision
 * retries on a slow or failed response, and posting to several Discord webhooks is slower
 * than it will wait - so the reply says "received", not "posted". A failure after that
 * point is a log line, which is the existing behaviour and not something this port should
 * quietly change.
 */
export async function POST(request: Request): Promise<NextResponse> {
    const body = await readJsonWithLimit(request, WEBHOOK_MAX_BYTES);
    if (!body.ok) {
        logger.warn('Rejected a forum webhook payload', { reason: body.reason });
        return new NextResponse(null, { status: body.status });
    }

    // Not awaited, on purpose - see above. `void` and a catch rather than a bare floating
    // promise: an unhandled rejection here would take the process down, and this handler
    // is reachable by anyone.
    void handleForumEvent(body.value, logger).catch((err: unknown) => {
        logger.warn('Error handling forum webhook', err);
    });

    return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
