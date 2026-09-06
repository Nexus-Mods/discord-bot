import crypto from 'node:crypto';

/**
 * cookie-parser's signing scheme, reimplemented.
 *
 * Next's cookie API does not sign - `cookies().set()` writes what it is given - and the
 * plan flags this as one that "has bitten this codebase before": `req.signedCookies`
 * simply disappearing means every read still compiles and every value is now attacker
 * controlled. There is no type error waiting for anyone.
 *
 * It is bit-for-bit cookie-parser's format rather than a nicer one of our own:
 *
 *     s:<value>.<base64 hmac-sha256 of <value>, trailing '=' stripped>
 *
 * so a cookie written by Express is readable by Next and the other way round. That
 * matters at the cutover: /revoke's confirm page and the OAuth callbacks change hands at
 * different steps, and for a while the two servers are both in the story. A format of our
 * own would have meant anyone mid-flow during the switch getting a rejected cookie.
 *
 * The one deliberate difference is `unsign`, which uses timingSafeEqual on equal-length
 * buffers. cookie-signature compares `sha1(mac) == sha1(val)` with `==` on hex strings -
 * hashing first does defuse the timing leak, but a constant-time compare says so directly
 * and does not depend on SHA-1 for anything.
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

/**
 * The value a signed cookie carries, or undefined.
 *
 * Undefined for every failure - missing, unsigned, truncated, wrong secret - because the
 * caller has nothing useful to do with the distinction and one of the failure modes is
 * "someone is trying things".
 */
export function unsignCookieValue(raw: string | undefined, secret: string): string | undefined {
    if (!raw || !raw.startsWith(SIGNED_PREFIX)) return undefined;

    const body = raw.slice(SIGNED_PREFIX.length);
    // The LAST dot: the link-state cookie's value is `v1.iv.tag.ciphertext`, so splitting
    // on the first one would take the signature from the middle of the payload.
    const dot = body.lastIndexOf('.');
    // `dot === 0` is an empty value, which cookie-signature does sign - rejecting it here
    // is what broke the interoperability test, and the whole point of that test is that a
    // rule invented on this side is a rule Express does not know about.
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
 * The attributes every cookie this site sets carries.
 *
 * The same set as `cookieOptions` in @nexusmods/auth/signing.js, minus `signed` - that
 * flag was an instruction to cookie-parser, and here signing is the caller's job via
 * signCookieValue. Naming the rest again rather than importing keeps the Next cookie API's
 * option shape (which spells maxAge in *seconds*) separate from Express's (milliseconds),
 * which is exactly the kind of silent unit change that turns a five-minute cookie into a
 * five-second one.
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
