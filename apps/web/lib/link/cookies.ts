import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { LINK_STATE_COOKIE } from '@nexusmods/auth/linkState.js';
import { cookieAttributes, signCookieValue, unsignCookieValue } from '@/lib/security/signedCookies';

/**
 * The three cookies the link and unlink flows use. Next has neither signing nor reading of
 * signed cookies, so both halves are spelled out here rather than at five call sites - the
 * failure mode being a route that compares an unverified `cookies.get()` value and
 * type-checks perfectly.
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
 * `response.cookies.delete()` omits the attributes, and a cookie set with `path: '/'` is
 * only replaceable by one with the same path - so it would be ignored.
 */
export function clearSignedCookie(response: NextResponse, name: string): void {
    response.cookies.set(name, '', { ...cookieAttributes(0), maxAge: 0 });
}

/** The verified value, or undefined when absent, unsigned or signed with another secret. */
export function readSignedCookie(request: Request, name: string): string | undefined {
    const raw = cookieValue(request.headers.get('cookie'), name);
    return unsignCookieValue(raw, secret());
}

/** The same read, from a server component, where the cookie store is async. */
export async function readSignedCookieFromStore(name: string): Promise<string | undefined> {
    const store = await cookies();
    return unsignCookieValue(store.get(name)?.value, secret());
}

/** Parsed here rather than via NextRequest, so handlers can take a plain `Request`. */
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
