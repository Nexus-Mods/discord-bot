import { ConfigError, DatabaseError } from '@nexusmods/core/errors.js';
import { deriveKey, isSealed, open, seal } from '@nexusmods/core/sealedValue.js';

/**
 * Encryption for the OAuth tokens in the users table.
 *
 * Protects against a copy of the database leaving without the droplet - a backup on a
 * laptop, a dump in a ticket. It does NOT protect against someone who has the droplet:
 * they have the key and the database both. A managed KMS is what would change that.
 *
 * TOKEN_ENCRYPTION_KEY is deliberately not COOKIE_SECRET: rotating the cookie secret costs
 * five minutes of in-flight logins, rotating this one without re-encrypting first destroys
 * every account link.
 */

const PURPOSE = 'user-tokens.v1';

/**
 * Keys in the order they are tried, newest first. TOKEN_ENCRYPTION_KEY_OLD lets both be
 * accepted during a rotation.
 *
 * DO NOT remove TOKEN_ENCRYPTION_KEY_OLD after a backfill run until a re-seal pass exists.
 * The backfill seals where `needsSealing` is true, which is false for a value already
 * sealed under the old key - so it skips every row and reports success, and dropping the
 * old key then makes all of them unreadable at once. `needsResealing` is the right test.
 */
function keys(): Buffer[] {
    const current = process.env.TOKEN_ENCRYPTION_KEY;
    if (!current) {
        throw new ConfigError('TOKEN_ENCRYPTION_KEY is not set', {
            context: { hint: 'Generate one with: openssl rand -base64 32' },
            userMessage: 'The bot is misconfigured and cannot start.',
        });
    }
    const previous = process.env.TOKEN_ENCRYPTION_KEY_OLD;
    return previous ? [deriveKey(current, PURPOSE), deriveKey(previous, PURPOSE)] : [deriveKey(current, PURPOSE)];
}

/** Fail at boot rather than on the first token write. */
export function assertTokenKeyConfigured(): void {
    const probe = 'configuration check';
    const sealed = sealToken(probe);
    if (openToken(sealed) !== probe) {
        throw new ConfigError('TOKEN_ENCRYPTION_KEY is set but does not round-trip', {
            userMessage: 'The bot is misconfigured and cannot start.',
        });
    }
}

export function sealToken(plaintext: string): string {
    return seal(plaintext, keys()[0]);
}

/**
 * Read a token column. Throws on a non-empty value that is not sealed: since the backfill
 * ran, plaintext means something is writing tokens outside `sealUserTokens`. Callers treat
 * the throw as "unlinked"; `npm run tokens:backfill` is the recovery.
 *
 * Null and empty are the absence of a token, not a fault. A sealed value that will not
 * open returns null, so one unreadable row does not fail every read.
 */
export function openToken(value: string | null | undefined, column: string = 'token'): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (!isSealed(value)) {
        // The value is never logged: it is a live credential.
        throw new DatabaseError(`Refusing to use an unencrypted value from ${column}`, {
            context: { column, hint: 'Run `npm run tokens:verify` to count, then `npm run tokens:backfill` to seal.' },
            isOperational: false,
            userMessage: 'Your linked account could not be read. Please link it again.',
        });
    }
    return open(value, keys());
}

/** Whether a stored value is still plaintext. Used on every write, and by the backfill. */
export function needsSealing(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.length > 0 && !isSealed(value);
}

/**
 * Whether a value is sealed under an older key and must be re-sealed before
 * TOKEN_ENCRYPTION_KEY_OLD can be removed - ie. does it open under the current key ALONE.
 *
 * `needsSealing` cannot answer this: it asks "is this plaintext", which is false for every
 * row mid-rotation. With no old key configured, nothing needs re-sealing.
 */
export function needsResealing(value: string | null | undefined): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;
    if (!isSealed(value)) return false;
    const configured = keys();
    if (configured.length === 1) return false;
    return open(value, [configured[0]]) === null;
}

/**
 * Open under whichever configured key works, and seal under the current one.
 *
 * Returns null when the value opens under no configured key. That is not recoverable
 * here - the plaintext is gone - so the caller should leave the row alone rather than
 * write something derived from nothing.
 */
export function resealToken(value: string): string | null {
    const plaintext = open(value, keys());
    if (plaintext === null) return null;
    return sealToken(plaintext);
}

/** The four columns that hold credentials. Nothing else in the row is encrypted. */
const TOKEN_COLUMNS = ['nexus_access', 'nexus_refresh', 'discord_access', 'discord_refresh'] as const;

type TokenColumn = (typeof TOKEN_COLUMNS)[number];

/**
 * Deliberately `object` rather than a shape carrying the token columns. These are
 * called with partial updates - an avatar change, a supporter flag - and a constraint
 * naming the token columns rejects an object literal that has none of them, which is
 * exactly the case that must pass through untouched.
 */
type Row = Record<string, unknown>;

/**
 * Decrypt the token columns on a row leaving the database.
 *
 * Applied at every point a users row is read, so nothing above the data layer ever
 * sees ciphertext - DiscordBotUser and the auth site are unchanged by this work.
 * Returns a new object rather than mutating, because the caller's row may be shared.
 */
export function openUserTokens<T extends object>(row: T): T {
    if (!row) return row;
    const out = { ...row } as Row;
    for (const column of TOKEN_COLUMNS satisfies readonly TokenColumn[]) {
        if (column in out) out[column] = openToken(out[column] as string | null | undefined, column);
    }
    return out as T;
}

/**
 * Encrypt the token columns on data entering the database.
 *
 * Only touches keys that are present, so a partial update of, say, the avatar is
 * passed through untouched rather than having token columns invented for it. A value
 * that is already sealed is left alone, so this cannot double-encrypt.
 */
export function sealUserTokens<T extends object>(data: T): T {
    if (!data) return data;
    const out = { ...data } as Row;
    for (const column of TOKEN_COLUMNS satisfies readonly TokenColumn[]) {
        if (needsSealing(out[column] as string | null | undefined)) out[column] = sealToken(out[column] as string);
    }
    return out as T;
}
