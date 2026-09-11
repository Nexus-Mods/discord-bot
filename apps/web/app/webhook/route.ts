import { NextResponse } from 'next/server';
import { logger } from '@nexusmods/core/logger.js';
import { WEBHOOK_MAX_BYTES, readJsonWithLimit } from '@/lib/security/bodyLimit';
import { handleForumEvent } from '@/lib/forum/webhook';
import { requireQuerySecret } from '@/lib/machineRoute';

/**
 * POST /webhook?key=<secret> - Invision posts here when a forum topic is created.
 *
 * The secret is in the URL because Invision attaches no headers and cannot be made to, so
 * the target URL is the only configurable part of the request. It closes "anyone who knows
 * the path"; it does not make the payload trustworthy, and the payload controls the whole
 * embed. The `forum.id` filter below is no defence, since it reads the same body.
 *
 * Answers 200 before doing the work: Invision retries on a slow response, and posting to
 * several Discord webhooks is slower than it will wait.
 */
export async function POST(request: Request): Promise<NextResponse> {
    // Before the body is read, so an unauthenticated caller cannot make us buffer 5MB.
    const denied = requireQuerySecret(request, 'key', 'FORUM_WEBHOOK_SECRET');
    if (denied) return denied;

    const body = await readJsonWithLimit(request, WEBHOOK_MAX_BYTES);
    if (!body.ok) {
        logger.warn('Rejected a forum webhook payload', { reason: body.reason });
        return new NextResponse(null, { status: body.status });
    }

    // Not awaited. `void` with a catch, not a floating promise: an unhandled rejection
    // would take the process down and this handler is reachable by anyone.
    void handleForumEvent(body.value, logger).catch((err: unknown) => {
        logger.warn('Error handling forum webhook', err);
    });

    return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
