import crypto from 'node:crypto';

/**
 * The in-flight state of an account link, sealed into a cookie.
 *
 * The link flow spans two OAuth round trips: Discord hands back tokens, then the user
 * goes off to Nexus Mods and comes back, and only then is there enough to write a row.
 * The Discord tokens have to survive that gap. They used to survive it in a Map on the
 * AuthSite instance, which made the web service single-replica by construction and
 * meant every deploy dropped anyone mid-link into a 403 - the tokens went with the
 * process.
 *
 * The fix is not to move the state somewhere more durable. It is to stop the server
 * holding it. A table would have put live Discord access and refresh tokens in a second
 * place on disk in plaintext, which is the thing Phase 3.4 exists to stop; sealing them
 * into a cookie the browser carries through the redirect chain leaves the server with no
 * state at all, so replica count and restarts stop mattering rather than mattering less.
 *
 * The trade, stated plainly: the tokens spend up to five minutes on the user's own
 * device instead of in the server's memory. They are that user's own tokens, they are
 * encrypted with a key the client does not have, the cookie is httpOnly so page scripts
 * cannot read it, and they are about to be stored server-side anyway.
 *
 * The ciphertext format is deliberately versioned - `v1.iv.tag.ciphertext` - because
 * Phase 3.4 needs the same shape for the tokens in the users table, and a five-minute
 * value is a much better place to get rotation and rejection behaviour right than
 * 147,000 rows where losing the key costs every linked user a re-link.
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

const VERSION = 'v1';

/**
 * A secret is not a key. HKDF turns the cookie secret into 32 bytes suitable for
 * AES-256, and the info string scopes it - the same secret used elsewhere derives a
 * different key, so this cookie cannot be swapped for another use of the same value.
 */
function keyFor(secret: string): Buffer {
    return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.alloc(0), Buffer.from('link-state.v1'), 32));
}

export function sealLinkState(payload: LinkState, secret: string, ttlMs: number = LINK_STATE_TTL_MS): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyFor(secret), iv);
    const body: SealedPayload = { ...payload, exp: Date.now() + ttlMs };
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(body), 'utf8')), cipher.final()]);
    return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

/**
 * Returns null for every failure - tampered, expired, wrong secret, wrong state,
 * malformed, absent. The caller cannot act differently on any of them, and a function
 * that throws four different ways here invites a catch block that treats a forged
 * cookie as a transient error.
 *
 * `expectedState` binds the payload to the OAuth state on the request. Without it a
 * cookie captured from one link attempt would complete a different one.
 */
export function openLinkState(sealed: unknown, secret: string, expectedState: string): LinkState | null {
    if (typeof sealed !== 'string') return null;
    const [version, iv, tag, ciphertext] = sealed.split('.');
    if (version !== VERSION || !iv || !tag || !ciphertext) return null;

    let parsed: SealedPayload;
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyFor(secret), Buffer.from(iv, 'base64url'));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        const plain = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]);
        parsed = JSON.parse(plain.toString('utf8')) as SealedPayload;
    }
    catch {
        // A bad auth tag, a wrong key and malformed base64 all land here. GCM verifies
        // the tag in final(), so tampering cannot get past this point.
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
