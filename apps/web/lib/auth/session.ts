import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_MS, openSession, sealSession } from '@nexusmods/auth/session.js';
import type { WebSession } from '@nexusmods/auth/session.js';
import { cookieAttributes } from '@/lib/security/signedCookies';

/**
 * Reading and writing the session cookie.
 *
 * Not run through signCookieValue like the others. Those carry plaintext and need a
 * signature to prove the server set them; this one is AES-GCM sealed, so tampering already
 * fails to open. Signing it as well would add a second thing to get wrong and prove
 * nothing new.
 */

function secret(): string {
    const value = process.env.COOKIE_SECRET;
    if (!value) throw new Error('COOKIE_SECRET is not set.');
    return value;
}

export function setSession(response: NextResponse, session: WebSession): void {
    response.cookies.set(SESSION_COOKIE, sealSession(session, secret()), cookieAttributes(SESSION_TTL_MS));
}

/**
 * `response.cookies.delete()` omits the attributes, and a cookie set with `path: '/'` is
 * only replaceable by one with the same path - so it would be ignored.
 */
export function clearSession(response: NextResponse): void {
    response.cookies.set(SESSION_COOKIE, '', { ...cookieAttributes(0), maxAge: 0 });
}

/** The session from a route handler's plain Request, or null. */
export function sessionFrom(request: Request): WebSession | null {
    return openSession(cookieValue(request.headers.get('cookie'), SESSION_COOKIE), secret());
}

/** The same read, from a server component, where the cookie store is async. */
export async function currentSession(): Promise<WebSession | null> {
    const store = await cookies();
    return openSession(store.get(SESSION_COOKIE)?.value, secret());
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
