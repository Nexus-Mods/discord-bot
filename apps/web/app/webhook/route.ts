import { NextResponse } from 'next/server';
import { logger } from '@nexusmods/core/logger.js';
import { WEBHOOK_MAX_BYTES, readJsonWithLimit } from '@/lib/security/bodyLimit';
import { handleForumEvent } from '@/lib/forum/webhook';
import { requireQuerySecret } from '@/lib/machineRoute';

/**
 * POST /webhook?key=<secret> - Invision posts here when a forum topic is created.
 *
 * This was S3, the last exploitable finding from the original audit: the endpoint took a
 * 5MB POST from anyone who knew the URL and rendered it into a Discord channel. What the
 * payload controls is the whole embed - the clickable title link, the author name, the
 * author's avatar image, and two thousand characters of text - so a caller could put a
 * message that looks exactly like a genuine Nexus Mods suggestion, carrying any link they
 * liked, in front of everyone in that channel. The `forum.id === 9063` filter below is no
 * defence against that: it reads the id out of the same body.
 *
 * The secret is in the URL because there is nowhere else to put it. Invision attaches no
 * headers of its own, and this installation cannot be made to attach one, so the target
 * URL is the only part of the request the sending side lets anyone configure.
 *
 * That is a bearer token in a URL, and worth being clear-eyed about: it ends up in access
 * logs and in the forum's admin screen, and anyone who reads either has the endpoint. It
 * closes "anyone who knows the path", which was the finding; it does not make the payload
 * trustworthy. The stronger version - taking only the topic id and re-fetching the topic
 * from the forum API, which needs nothing from the sender - is a separate change and is
 * recorded in MODERNISATION.md.
 *
 * The 5MB cap still matters and is still enforced by reading and counting rather than
 * configured on a parser that has already been handed the request.
 *
 * It answers 200 before doing the work, exactly as the Express version does. Invision
 * retries on a slow or failed response, and posting to several Discord webhooks is slower
 * than it will wait - so the reply says "received", not "posted". A failure after that
 * point is a log line, which is the existing behaviour and not something this port should
 * quietly change.
 */
export async function POST(request: Request): Promise<NextResponse> {
    // Before the body is read, so an unauthenticated caller cannot make this process
    // buffer five megabytes on its way to being refused.
    const denied = requireQuerySecret(request, 'key', 'FORUM_WEBHOOK_SECRET');
    if (denied) return denied;

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
