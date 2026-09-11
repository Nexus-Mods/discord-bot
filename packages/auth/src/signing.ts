import crypto from 'crypto';

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
 * Check a provided secret against one held in an environment variable.
 *
 * FAILS CLOSED: an unset variable means the endpoint is unavailable, not unprotected.
 * Takes a string rather than a request, so both servers share one comparison.
 */
export function checkSharedSecret(provided: string | null | undefined, envVar: string): boolean {
    const expected = process.env[envVar];
    if (!expected) return false;
    if (typeof provided !== 'string' || provided === '') return false;
    return safeCompare(provided, expected);
}

/** Checked at boot, so a missing value is loud. The reason travels with the name for the log line. */
export const REQUIRED_SECRETS: ReadonlyArray<{ name: string; reason: string }> = [
    { name: 'COOKIE_SECRET', reason: 'The OAuth flow signs its state cookie with it' },
    { name: 'UNLINK_SECRET', reason: 'Unlink links are signed with it' },
    // Not signed with, but the tracking page cannot resolve names without it.
    { name: 'DISCORD_TOKEN', reason: 'The tracking page resolves guild and channel names with it' },
];

export const OPTIONAL_SECRETS: ReadonlyArray<string> = [
    'AUTOMOD_AUTHCODE',
    'ADMIN_AUTHCODE',
    // Carried in the URL, not a header: Invision cannot attach one. A bearer token in a
    // place that reaches access logs, so rotate it if those are ever exposed.
    'FORUM_WEBHOOK_SECRET',
];

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

/** The link URL handed to a user in Discord. */
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
