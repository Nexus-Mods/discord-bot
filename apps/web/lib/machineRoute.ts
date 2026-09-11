import { NextResponse } from 'next/server';
import { checkSharedSecret } from '@nexusmods/auth/signing.js';

/**
 * Shared replies for the four machine endpoints - /webhook, /automod, /show-metadata and
 * /update-metadata. No route segment config: `runtime` is deprecated in Next 16 and route
 * handlers are not cached, so neither export says anything.
 */

/**
 * Refuse unless the Authorization header matches the named secret. Returns a response to
 * send, or undefined to carry on, so a caller cannot fall through a failed check.
 *
 * Empty 401 body: the caller learns nothing about whether the secret is unset or wrong.
 */
export function requireSharedSecret(request: Request, envVar: string): NextResponse | undefined {
    if (checkSharedSecret(request.headers.get('authorization'), envVar)) return undefined;
    return new NextResponse(null, { status: 401 });
}

/**
 * The same refusal for a secret in the query string. /webhook needs this because Invision
 * cannot attach a header, so the target URL is the only configurable part of the request.
 */
export function requireQuerySecret(request: Request, param: string, envVar: string): NextResponse | undefined {
    const provided = new URL(request.url).searchParams.get(param);
    if (checkSharedSecret(provided, envVar)) return undefined;
    return new NextResponse(null, { status: 401 });
}

/** `res.status(n).send(text)` - a plain body, never HTML, never a rendered error page. */
export function text(body: string, status: number): NextResponse {
    return new NextResponse(body, {
        status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

/** JSON, where Express sent these as text/html because `res.send()` on a string guesses. */
export function json(body: unknown, status: number, spaces?: number): NextResponse {
    return new NextResponse(JSON.stringify(body, null, spaces), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

/** `Unexpected error: ${message}`, the shape the automod client already sees on a 500. */
export function unexpected(err: unknown): NextResponse {
    return text(`Unexpected error: ${(err as Error)?.message}`, 500);
}
