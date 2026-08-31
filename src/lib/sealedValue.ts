import crypto from 'node:crypto';

/**
 * Authenticated encryption for values this application stores or hands out.
 *
 * One envelope format, used in two places: the in-flight link state that rides a
 * cookie through the OAuth redirect chain, and the OAuth tokens at rest in the users
 * table. They have different payloads, different key sources and different lifetimes,
 * but the envelope is the same and there is no case for two implementations of it.
 *
 *     v1.<iv>.<tag>.<ciphertext>      all base64url
 *
 * The version is first and outside the ciphertext on purpose: it lets a reader decide
 * how to interpret a value before trying to decrypt it, which is what makes a format
 * change survivable. It is also what lets `isSealed` tell an encrypted column apart
 * from one that has not been migrated yet, without a schema change or a flag column.
 *
 * AES-256-GCM rather than CBC or CTR: the authentication tag means a tampered value
 * fails to open rather than decrypting to plausible rubbish. For tokens at rest that
 * matters less than it does for a cookie the user holds, but there is no reason to
 * take the weaker option in either place.
 */

const VERSION = 'v1';
const IV_BYTES = 12;   // 96 bits, the size GCM is specified for
const KEY_BYTES = 32;  // AES-256

/**
 * Matches any version of the envelope, so a plaintext value is never mistaken for a
 * sealed one. Deliberately broader than what `open` will decrypt: `isSealed` answers
 * "has this been encrypted", which stays true for a future v2, while `open` answers
 * "can I decrypt this", which does not.
 */
// The ciphertext segment is `*` not `+`: sealing an empty string produces an empty
// ciphertext, and a column holding '' must still round-trip.
const ENVELOPE = /^v\d+\.[\w-]+\.[\w-]+\.[\w-]*$/;

/**
 * A secret is not a key.
 *
 * HKDF turns a human-supplied string of arbitrary length and entropy into exactly 32
 * uniform bytes. The `purpose` becomes the info parameter, so two callers deriving
 * from the same secret get cryptographically unrelated keys - which is what lets one
 * secret serve more than one job without the jobs being able to read each other.
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
 * Open a sealed value, trying each key in turn.
 *
 * The list is what makes key rotation possible without downtime: put the new key
 * first and the old one second, and both old and new values open while a backfill
 * re-seals everything under the new key. Once nothing opens with the old key, drop it.
 *
 * Returns null for every failure - wrong key, tampered value, malformed input,
 * something that was never sealed. No caller can act differently on any of them, and a
 * function that throws several ways here invites a catch that treats a forged value as
 * a transient error.
 */
export function open(sealed: unknown, keys: Buffer[]): string | null {
    if (typeof sealed !== 'string' || !ENVELOPE.test(sealed)) return null;
    const [version, iv, tag, ciphertext] = sealed.split('.');
    // Only decrypt versions this code understands. The version prefix sits outside the
    // authenticated data - it has to, since it selects how to authenticate - so anyone
    // can change it. Refusing an unknown version is what stops a future format being
    // fed to this one's decryption and either failing obscurely or succeeding on
    // something it should not have.
    if (version !== VERSION) return null;

    for (const key of keys) {
        try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
            decipher.setAuthTag(Buffer.from(tag, 'base64url'));
            // final() verifies the tag, so a wrong key or a tampered value throws here.
            return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
        }
        catch {
            // Try the next key. Failing over is the whole point of accepting a list.
        }
    }
    return null;
}

/**
 * Whether a value carries the envelope.
 *
 * This is what lets a column hold sealed and unsealed values at once, which is what
 * makes the migration a backfill rather than a big bang: the read path checks the
 * shape rather than a flag, so a row that has not been converted yet still works.
 *
 * It checks the whole shape, not just the prefix. Nexus Mods issues OpenID tokens,
 * some of which are JWTs - three dot-separated segments. The envelope has four.
 */
export function isSealed(value: unknown): value is string {
    return typeof value === 'string' && ENVELOPE.test(value);
}
