import crypto from 'node:crypto';
import { deriveKey, open as openSealed, seal } from '@nexusmods/core/sealedValue.js';

/**
 * The in-flight state of an account link, sealed into a cookie.
 *
 * The flow spans two OAuth round trips, so the Discord tokens have to survive the gap.
 * They used to live in a Map on the server, which made the service single-replica and made
 * every deploy drop anyone mid-link into a 403. Sealing them into a cookie leaves the
 * server holding no state at all.
 *
 * The trade: the tokens spend up to five minutes on the user's own device, encrypted with
 * a key the client does not have, in an httpOnly cookie, and they are about to be stored
 * server-side anyway.
 */
export interface LinkState {
    /** The OAuth state this payload belongs to. Checked on open, so one flow's cookie cannot finish another. */
    state: string;
    /** Discord user id. */
    id: string;
    /** Display name, used for the success page and the log line. */
    name: string;
    tokens: {
        access_token: string;
        refresh_token: string;
        expires_at: number;
        token_type?: string;
        scope?: string;
    };
}

interface SealedPayload extends LinkState {
    /** Absolute expiry, enforced on open. The cookie's maxAge is a client-side courtesy. */
    exp: number;
}

export const LINK_STATE_COOKIE = 'linkState';
export const LINK_STATE_TTL_MS = 5 * 60 * 1000;


/** Scoped so the cookie secret's other uses derive unrelated keys. */
const keyFor = (secret: string): Buffer => deriveKey(secret, 'link-state.v1');

export function sealLinkState(payload: LinkState, secret: string, ttlMs: number = LINK_STATE_TTL_MS): string {
    const body: SealedPayload = { ...payload, exp: Date.now() + ttlMs };
    return seal(JSON.stringify(body), keyFor(secret));
}

/**
 * Null for every failure, so a forged cookie cannot be caught as a transient error.
 *
 * `expectedState` binds the payload to this request's OAuth state - without it, a cookie
 * captured from one attempt would complete another.
 */
export function openLinkState(sealed: unknown, secret: string, expectedState: string): LinkState | null {
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
    if (typeof parsed.state !== 'string' || !safeEqual(parsed.state, expectedState)) return null;
    if (typeof parsed.id !== 'string' || typeof parsed.tokens?.access_token !== 'string') return null;

    return { state: parsed.state, id: parsed.id, name: parsed.name, tokens: parsed.tokens };
}

function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}
