import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { LINK_STATE_COOKIE } from '@nexusmods/auth/linkState.js';
import { cookieAttributes, signCookieValue, unsignCookieValue } from '@/lib/security/signedCookies';

/**
 * The three cookies the link and unlink flows use, in one place.
 *
 * Express reached for `req.signedCookies` and `res.cookie(..., { signed: true })` and got
 * signing from cookie-parser. Next has neither half, so both are spelled out here rather
 * than at each of the five call sites - the failure mode of spreading it out is a route
 * that reads `request.cookies.get('clientState')` and compares the raw, unverified value,
 * which type-checks perfectly and accepts anything the client sends.
 *
 * Every function here takes the secret from the environment at call time. bootCheck
 * refuses to start the site without COOKIE_SECRET, so the non-null assertion is checked
 * before any request can arrive - but it is asserted rather than defaulted, because a
 * default would silently sign with a known value.
 */

export const CLIENT_STATE_COOKIE = 'clientState';
export const ERROR_DETAIL_COOKIE = 'ErrorDetail';
export { LINK_STATE_COOKIE };

/** The OAuth state cookie's lifetime, from Express: `cookieOptions(1000 * 60 * 5)`. */
export const CLIENT_STATE_TTL_MS = 5 * 60 * 1000;
/** How long an error message survives for the page that displays it. Express: two minutes. */
export const ERROR_DETAIL_TTL_MS = 2 * 60 * 1000;

function secret(): string {
    const value = process.env.COOKIE_SECRET;
    if (!value) throw new Error('COOKIE_SECRET is not set.');
    return value;
}

/** Set a signed cookie on a response being returned from a route handler. */
export function setSignedCookie(response: NextResponse, name: string, value: string, maxAgeMs: number): void {
    response.cookies.set(name, signCookieValue(value, secret()), cookieAttributes(maxAgeMs));
}

/**
 * Delete a cookie by setting it empty and expired.
 *
 * `response.cookies.delete(name)` omits the attributes, and a cookie set with `path: '/'`
 * is only replaceable by one with the same path - so the delete would be ignored and the
 * sealed Discord tokens would stay in the browser for the rest of their five minutes.
 */
export function clearSignedCookie(response: NextResponse, name: string): void {
    response.cookies.set(name, '', { ...cookieAttributes(0), maxAge: 0 });
}

/**
 * A signed cookie's verified value, from a request in a route handler.
 *
 * Undefined when it is absent, unsigned, or signed with a different secret - the same
 * three cases cookie-parser collapses into "not in signedCookies".
 */
export function readSignedCookie(request: Request, name: string): string | undefined {
    const raw = cookieValue(request.headers.get('cookie'), name);
    return unsignCookieValue(raw, secret());
}

/** The same read, from a server component, where the cookie store is async. */
export async function readSignedCookieFromStore(name: string): Promise<string | undefined> {
    const store = await cookies();
    return unsignCookieValue(store.get(name)?.value, secret());
}

/**
 * One cookie out of a Cookie header.
 *
 * Parsed here rather than via NextRequest.cookies so the route handlers can take a plain
 * `Request`: that is what makes them testable by calling the exported GET with a
 * hand-built Request, which is how every test in this step drives them.
 */
function cookieValue(header: string | null, name: string): string | undefined {
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        if (part.slice(0, eq).trim() !== name) continue;
        return decodeURIComponent(part.slice(eq + 1).trim());
    }
    return undefined;
}
