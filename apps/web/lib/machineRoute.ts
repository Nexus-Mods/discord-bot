import { NextResponse } from 'next/server';
import { checkSharedSecret } from '@nexusmods/auth/signing.js';

/**
 * The things all four machine endpoints do the same way.
 *
 * /webhook, /automod, /show-metadata and /update-metadata have no UI. They answer
 * machines, so they answer in status codes and plain bodies, and three of the four are
 * guarded by a shared secret that must fail closed when it is not configured. That
 * property is the whole point of the guard and it is the one thing here with a test.
 */

/*
 * There is deliberately no route segment config here.
 *
 * The bundled Next 16 docs are clear on both halves: "Route Handlers are not cached by
 * default", so `dynamic = 'force-dynamic'` says nothing; and `runtime` defaults to
 * 'nodejs' with "The Edge Runtime is deprecated. Remove the `runtime` export from your
 * route files." Every one of these reads the request anyway - the shared-secret guard
 * reads a header before anything else - which the docs list as one of the things that
 * stops prerendering.
 *
 * Worth reading rather than remembering: apps/web/AGENTS.md, which `next dev` writes,
 * says the local docs are the source of truth for this version, and both of those config
 * exports came from an older one.
 */

/**
 * Refuse unless the Authorization header matches the named secret.
 *
 * Returns a response to send, or undefined to carry on - so a route reads as
 * `const denied = requireSharedSecret(...); if (denied) return denied;` and cannot
 * accidentally continue past a failed check the way an `if (!ok) { ... }` with a missing
 * `return` can.
 *
 * 401 with an empty body, matching Express's `res.sendStatus(401)`: an unauthenticated
 * caller learns nothing about whether the secret is unset, wrong, or the endpoint exists.
 */
export function requireSharedSecret(request: Request, envVar: string): NextResponse | undefined {
    if (checkSharedSecret(request.headers.get('authorization'), envVar)) return undefined;
    return new NextResponse(null, { status: 401 });
}

/** `res.status(n).send(text)` - a plain body, never HTML, never a rendered error page. */
export function text(body: string, status: number): NextResponse {
    return new NextResponse(body, {
        status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

/**
 * `res.status(n).send(JSON.stringify(x))`.
 *
 * Express sent these with `Content-Type: text/html` on the automod routes, because
 * `res.send()` on a string guesses - the handler stringified the rows itself rather than
 * calling res.json(). Sent as application/json here, which is what the callers were
 * already parsing it as. That is the one deliberate difference in these four endpoints.
 */
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
