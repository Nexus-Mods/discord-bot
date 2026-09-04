import crypto from 'crypto';
import type express from 'express';

/**
 * Compare two strings without leaking length-independent timing information.
 */
export function safeCompare(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify the Authorization header against a shared secret held in an environment
 * variable.
 *
 * This FAILS CLOSED: if the environment variable is not set, the endpoint is
 * treated as unavailable rather than unprotected. Previously a missing secret
 * left the endpoint open to anyone.
 */
export function checkSharedSecret(req: express.Request, envVar: string): boolean {
    const expected = process.env[envVar];
    if (!expected) return false;
    const provided = req.headers.authorization;
    if (typeof provided !== 'string' || provided === '') return false;
    return safeCompare(provided, expected);
}

/**
 * The shared secrets the site expects in the environment, checked at boot so a missing
 * value is loud rather than silent.
 *
 * These lists existed but nothing read them - server.ts wrote the same two names out
 * again inline, which is a duplicate that only ever drifts in one direction: a secret
 * added here and not there is unchecked. The reasons live with the names so the boot
 * message can be specific without the caller having to know what each one is for.
 */
export const REQUIRED_SECRETS: ReadonlyArray<{ name: string; reason: string }> = [
    { name: 'COOKIE_SECRET', reason: 'The OAuth flow signs its state cookie with it' },
    { name: 'UNLINK_SECRET', reason: 'Unlink links are signed with it' },
];

export const OPTIONAL_SECRETS: ReadonlyArray<string> = ['AUTOMOD_AUTHCODE', 'ADMIN_AUTHCODE'];

/**
 * Standard options for any cookie this site sets.
 * - httpOnly  keeps the value out of page scripts
 * - secure    in production, so it is never sent over plain HTTP
 * - sameSite  'lax' so the cookie still survives the OAuth redirect chain
 */
export function cookieOptions(maxAgeMs: number): {
    maxAge: number; signed: boolean; httpOnly: boolean; secure: boolean; sameSite: 'lax';
} {
    return {
        maxAge: maxAgeMs,
        signed: true,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    };
}

/**
 * Sign a value so a URL handed to a user cannot be reused for anyone else.
 * Returns "<expiry>.<signature>" where expiry is a unix timestamp in ms.
 */
export function signValue(value: string, ttlMs: number, secret: string): string {
    const expires = Date.now() + ttlMs;
    const sig = crypto.createHmac('sha256', secret).update(`${value}.${expires}`).digest('base64url');
    return `${expires}.${sig}`;
}

/**
 * Build the unlink URL handed to a user in Discord. The Discord ID is signed so a
 * link cannot be edited to point at somebody else's account.
 */
export function linkUrl(discordId: string): string {
    const base = process.env.SITE_BASE_URL ?? 'https://discordbot.nexusmods.com/';
    return `${base}linked-role?id=${encodeURIComponent(discordId)}`;
}

/**
 * Build the unlink URL handed to a user in Discord. The Discord ID is signed so a
 * link cannot be edited to point at somebody else's account.
 */
export function unlinkUrl(discordId: string): string {
    const base = process.env.SITE_BASE_URL ?? 'https://discordbot.nexusmods.com/';
    const secret = process.env.UNLINK_SECRET;
    if (!secret) return `${base}revoke`;
    const token = signValue(discordId, 1000 * 60 * 60 * 24, secret);
    return `${base}revoke?id=${encodeURIComponent(discordId)}&token=${encodeURIComponent(token)}`;
}

/**
 * Verify a token produced by signValue. Returns false if it is malformed,
 * expired, or signed with a different secret.
 */
export function verifyValue(value: string, token: string | undefined, secret: string): boolean {
    if (!token) return false;
    const [expiresRaw, sig] = token.split('.');
    const expires = Number(expiresRaw);
    if (!expiresRaw || !sig || isNaN(expires)) return false;
    if (Date.now() > expires) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${value}.${expires}`).digest('base64url');
    return safeCompare(sig, expected);
}
