import type { NextResponse } from 'next/server';
import { logger } from '@nexusmods/core/logger.js';
import { readJsonWithLimit } from '@/lib/security/bodyLimit';
import { createNewRule, deleteRule, getAutomodRules, updateRule } from '@/lib/automod/rules';
import type { Rule } from '@/lib/automod/types';
import { json, requireSharedSecret, text, unexpected } from '@/lib/machineRoute';

/**
 * /automod - the rules the moderation service reads and the admin tool edits.
 *
 * Express registers this as `app.all` with a switch on the method; Next routes by exported
 * function, which is the same thing said once per verb. Every one of them is guarded by
 * AUTOMOD_AUTHCODE first, and that guard fails closed: with the variable unset every
 * request is refused rather than let through.
 *
 * Two differences from the Express version, both deliberate:
 *
 *   - The rule bodies come back as application/json. Express sent them as text/html,
 *     because the handler called res.send() with a string it had stringified itself and
 *     res.send guesses. Every caller was already parsing them as JSON.
 *   - A verb with no export here - HEAD, OPTIONS - gets Next's 405. Express answered 500
 *     "Unrecognised HTTP Method" for those, which is a wrong status for a right refusal.
 *     PATCH keeps its 500, because that one is Express saying "not implemented" about a
 *     feature rather than about a verb.
 */
/** A rule is a few hundred bytes. This is not the webhook. */
const MAX_BYTES = 64 * 1024;

export async function GET(request: Request): Promise<NextResponse> {
    const denied = requireSharedSecret(request, 'AUTOMOD_AUTHCODE');
    if (denied) return denied;
    logger.info('Incoming automod request', 'GET');

    try {
        const params = new URL(request.url).searchParams;
        const limit = params.get('limit');
        const offset = params.get('offset');
        const rules = await getAutomodRules(
            logger,
            limit ? Number(limit) : undefined,
            offset ? Number(offset) : undefined,
        );
        return json(rules, 200);
    }
    catch (err) {
        return unexpected(err);
    }
}

export async function POST(request: Request): Promise<NextResponse> {
    const denied = requireSharedSecret(request, 'AUTOMOD_AUTHCODE');
    if (denied) return denied;
    logger.info('Incoming automod request', 'POST');

    const body = await readJsonWithLimit(request, MAX_BYTES);
    if (!body.ok) return text(`Unexpected error: ${body.reason}`, body.status);

    try {
        return json(await createNewRule(body.value as Omit<Rule, 'id'>), 201);
    }
    catch (err) {
        logger.error('Failed to create rule', err);
        return unexpected(err);
    }
}

export async function PUT(request: Request): Promise<NextResponse> {
    const denied = requireSharedSecret(request, 'AUTOMOD_AUTHCODE');
    if (denied) return denied;
    logger.info('Incoming automod request', 'PUT');

    const id = new URL(request.url).searchParams.get('id');
    const body = await readJsonWithLimit(request, MAX_BYTES);
    if (!id || !body.ok) return text('Invalid ID', 400);

    try {
        return json(await updateRule(body.value as Rule, Number(id)), 200);
    }
    catch (err) {
        return unexpected(err);
    }
}

export async function DELETE(request: Request): Promise<NextResponse> {
    const denied = requireSharedSecret(request, 'AUTOMOD_AUTHCODE');
    if (denied) return denied;

    const id = new URL(request.url).searchParams.get('id');
    logger.info('Deleting automod rule', id);
    if (!id || isNaN(parseInt(id, 10))) return text('Invalid ID', 400);

    try {
        await deleteRule(Number(id));
        logger.info('Deleted automod rule successfully', id);
        return json({ success: true }, 200);
    }
    catch (err) {
        return unexpected(err);
    }
}

export async function PATCH(request: Request): Promise<NextResponse> {
    const denied = requireSharedSecret(request, 'AUTOMOD_AUTHCODE');
    if (denied) return denied;
    return text('Not implemented', 500);
}
