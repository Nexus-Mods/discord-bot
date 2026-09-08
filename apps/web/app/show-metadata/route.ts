import type { NextResponse } from 'next/server';
import { getUserByDiscordId } from '@nexusmods/account/users.js';
import { logger } from '@nexusmods/core/logger.js';
import { json, requireSharedSecret, text } from '@/lib/machineRoute';

/**
 * GET /show-metadata?id=<discord id> - what Discord currently holds for a linked account.
 *
 * Admin only, because it exposes one person's role-connection metadata, and the guard
 * fails closed.
 *
 * The failure path was Express's, faithfully, and it was odd: an error set a signed
 * ErrorDetail cookie and redirected to /oauth-error, so an admin running curl against an
 * API got a 302 to an HTML page about linking accounts. Step 8 reproduced it and left this
 * note saying step 9 was the place to change it deliberately. This is that change: a plain
 * 500 with the message, the same shape /update-metadata already answers with.
 *
 * Nothing was reading the redirect. It arrives at /oauth-error, which renders "an error
 * occurred while attempting to link your accounts" and a Try again button pointing at
 * /linked-role - so a script following redirects would have started an OAuth flow, and one
 * not following them saw a 302 with an empty body either way.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const denied = requireSharedSecret(request, 'ADMIN_AUTHCODE');
    if (denied) return denied;

    try {
        const id = new URL(request.url).searchParams.get('id');
        if (!id) throw new Error('ID not sent');

        const user = await getUserByDiscordId(id);
        const meta = user ? await user.Discord.GetRemoteMetaData() : {};
        // Two-space indent, as Express sent it: a human reads this one.
        return json(meta, 200, 2);
    }
    catch (err) {
        logger.warn('Error in show-metadata endpoint', err);
        return text(`Error getting metadata: ${(err as Error).message}`, 500);
    }
}
