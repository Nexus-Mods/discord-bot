import { NextResponse } from 'next/server';
import { logger } from '@nexusmods/core/logger.js';
import { readJsonWithLimit } from '@/lib/security/bodyLimit';
import { updateDiscordMetadata } from '@/lib/discordMetadata';
import { requireSharedSecret, text } from '@/lib/machineRoute';

/**
 * POST /update-metadata - re-push one user's linked-role metadata to Discord.
 *
 * Admin only, and the guard fails closed: with ADMIN_AUTHCODE unset every request is
 * refused rather than let through. 204 on success and a plain-text 500 with the message on
 * failure, both as the Express version answers.
 */
const MAX_BYTES = 8 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
    const denied = requireSharedSecret(request, 'ADMIN_AUTHCODE');
    if (denied) return denied;

    try {
        const body = await readJsonWithLimit(request, MAX_BYTES);
        const userId = body.ok ? (body.value as { userId?: unknown } | null)?.userId : undefined;
        if (!userId || typeof userId !== 'string') {
            throw new Error('userId was not supplied in the request body.');
        }

        await updateDiscordMetadata(userId, logger);
        return new NextResponse(null, { status: 204 });
    }
    catch (err) {
        logger.warn('Error in update-meta endpoint', err);
        return text(`Error in update-meta request: ${(err as Error)?.message}`, 500);
    }
}
