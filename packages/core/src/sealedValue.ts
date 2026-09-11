import crypto from 'node:crypto';

/**
 * Authenticated encryption for the OAuth tokens at rest and the in-flight link cookie.
 *
 *     v1.<iv>.<tag>.<ciphertext>      all base64url
 *
 * AES-256-GCM, so a tampered value fails to open rather than decrypting to rubbish. The
 * version sits outside the ciphertext so a reader can tell sealed from unsealed - which is
 * what lets a column hold both during a backfill.
 */

const VERSION = 'v1';
const IV_BYTES = 12;   // 96 bits, the size GCM is specified for
const KEY_BYTES = 32;  // AES-256

// Matches ANY version, deliberately: `isSealed` means "encrypted", `open` means
// "decryptable by this code". The ciphertext segment is `*` not `+` so an empty string
// round-trips.
const ENVELOPE = /^v\d+\.[\w-]+\.[\w-]+\.[\w-]*$/;

/**
 * HKDF: a secret is not a key. `purpose` is the info parameter, so two callers deriving
 * from one secret get unrelated keys and cannot read each other's values.
 */
export function deriveKey(secret: string, purpose: string): Buffer {
    if (!secret) throw new Error('Cannot derive a key from an empty secret.');
    return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.alloc(0), Buffer.from(purpose, 'utf8'), KEY_BYTES));
}

export function seal(plaintext: string, key: Buffer): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
    return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

/**
 * Open a sealed value, trying each key in turn - new key first, old second, which is what
 * makes rotation possible without downtime.
 *
 * Null for every failure, so a forged value cannot be mistaken for a transient error.
 */
export function open(sealed: unknown, keys: Buffer[]): string | null {
    if (typeof sealed !== 'string' || !ENVELOPE.test(sealed)) return null;
    const [version, iv, tag, ciphertext] = sealed.split('.');
    // The version prefix is outside the authenticated data, so anyone can change it.
    // Refusing an unknown one stops a future format reaching this decryption.
    if (version !== VERSION) return null;

    for (const key of keys) {
        try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
            decipher.setAuthTag(Buffer.from(tag, 'base64url'));
            // final() verifies the tag, so a wrong key or a tampered value throws here.
            return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
        }
        catch { /* try the next key */ }
    }
    return null;
}

/**
 * Whether a value carries the envelope, so a column can hold sealed and unsealed rows at
 * once. Checks the whole shape: a JWT has three segments, this has four.
 */
export function isSealed(value: unknown): value is string {
    return typeof value === 'string' && ENVELOPE.test(value);
}
