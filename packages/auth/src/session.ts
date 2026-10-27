import { deriveKey, open as openSealed, seal } from '@nexusmods/core/sealedValue.js';

/**
 * A signed-in session, sealed into a cookie.
 *
 * The server holds nothing, exactly as the link flow holds nothing - see linkState.ts for
 * why that property is worth keeping. The cost is that a session cannot be revoked
 * server-side, which is why the TTL is hours rather than weeks.
 *
 * The Discord access token travels in the payload because the guild list has to be
 * re-read on a short cycle and there is nowhere else to keep it. The same trade as
 * linkState: encrypted with a key the client does not have, in an httpOnly cookie, and
 * scoped to `identify guilds` - it can read who the user is and what servers they are in,
 * and can do nothing else. It is deliberately NOT the link flow's token, which carries
 * role_connections.write.
 *
 * Nothing guild-shaped is stored here. A user in a few hundred servers would blow the
 * 4KB cookie limit, and a cached permission is a stale permission.
 */
export interface WebSession {
    /** Discord user id. */
    id: string;
    /** Display name, for the page header. */
    name: string;
    /** Avatar hash, or null for a default avatar. */
    avatar: string | null;
    /** Reads the guild list. Never leaves this process. */
    accessToken: string;
}

interface SealedPayload extends WebSession {
    /** Absolute expiry, enforced on open. The cookie's maxAge is a client-side courtesy. */
    exp: number;
}

export const SESSION_COOKIE = 'session';

/**
 * Eight hours. Long enough to not be a nuisance, short enough that a stolen cookie
 * expires on its own - which matters because nothing can take it back.
 */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Scoped so the cookie secret's other uses derive unrelated keys. */
const keyFor = (secret: string): Buffer => deriveKey(secret, 'web-session.v1');

export function sealSession(payload: WebSession, secret: string, ttlMs: number = SESSION_TTL_MS): string {
    const body: SealedPayload = { ...payload, exp: Date.now() + ttlMs };
    return seal(JSON.stringify(body), keyFor(secret));
}

/** Null for every failure, so a forged cookie cannot be caught as a transient error. */
export function openSession(sealed: unknown, secret: string): WebSession | null {
    const plain = openSealed(sealed, [keyFor(secret)]);
    if (plain === null) return null;

    let parsed: SealedPayload;
    try {
        parsed = JSON.parse(plain) as SealedPayload;
    }
    catch {
        // Opened but not the JSON we put in - treat exactly like a failure to open.
        return null;
    }

    if (typeof parsed?.exp !== 'number' || Date.now() > parsed.exp) return null;
    if (typeof parsed.id !== 'string' || !parsed.id) return null;
    if (typeof parsed.accessToken !== 'string' || !parsed.accessToken) return null;

    return {
        id: parsed.id,
        name: typeof parsed.name === 'string' ? parsed.name : parsed.id,
        avatar: typeof parsed.avatar === 'string' ? parsed.avatar : null,
        accessToken: parsed.accessToken,
    };
}
