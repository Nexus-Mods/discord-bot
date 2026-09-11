import crypto from 'node:crypto';

/**
 * cookie-parser's signing scheme, reimplemented - Next's cookie API does not sign.
 *
 *     s:<value>.<base64 hmac-sha256 of value, trailing '=' stripped>
 *
 * Bit-for-bit cookie-parser's format, so a cookie written by either server is readable by
 * the other and nobody mid-flow is dropped at the switch. `unsign` compares in constant
 * time rather than cookie-signature's `sha1(a) == sha1(b)`.
 */

/** cookie-parser marks a signed value with this prefix. Unprefixed means unsigned. */
const SIGNED_PREFIX = 's:';

function hmac(value: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(value).digest('base64').replace(/=+$/, '');
}

/** The cookie value to write. Includes the `s:` prefix, exactly as cookie-parser stores it. */
export function signCookieValue(value: string, secret: string): string {
    return `${SIGNED_PREFIX}${value}.${hmac(value, secret)}`;
}

/** The verified value, or undefined for every failure - missing, unsigned, wrong secret. */
export function unsignCookieValue(raw: string | undefined, secret: string): string | undefined {
    if (!raw || !raw.startsWith(SIGNED_PREFIX)) return undefined;

    const body = raw.slice(SIGNED_PREFIX.length);
    // The LAST dot: a sealed value is `v1.iv.tag.ciphertext`, so the first dot is inside
    // the payload. `dot === 0` is an empty value, which cookie-signature does sign.
    const dot = body.lastIndexOf('.');
    if (dot < 0 || dot === body.length - 1) return undefined;

    const value = body.slice(0, dot);
    const provided = body.slice(dot + 1);
    const expected = hmac(value, secret);

    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return undefined;
    return crypto.timingSafeEqual(a, b) ? value : undefined;
}

/**
 * The attributes every cookie here carries. Spelled out rather than imported from
 * `cookieOptions`, because Next's maxAge is in SECONDS and Express's is in milliseconds.
 */
export function cookieAttributes(maxAgeMs: number) {
    return {
        maxAge: Math.floor(maxAgeMs / 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
    };
}
