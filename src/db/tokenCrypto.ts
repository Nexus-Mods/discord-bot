import { ConfigError } from '../api/errors.js';
import { deriveKey, isSealed, open, seal } from '../lib/sealedValue.js';

/**
 * Encryption for the OAuth tokens in the users table.
 *
 * Four columns across ~37,000 rows hold live Discord and Nexus Mods credentials in
 * plaintext. What this protects against is narrow and likely: **a copy of the database
 * leaving without the droplet** - a backup downloaded to a laptop, a snapshot restored
 * to a less careful staging environment, a dump pasted into a ticket. The key lives in
 * the process environment and the tokens live in a managed database whose backups are
 * a separate artefact, so those two things do not travel together.
 *
 * It does not protect against someone who has the droplet. They have the environment
 * and the database credentials both, and encryption adds one `cat` to their day. That
 * is a real limit, not a footnote, and a managed KMS is what changes it.
 *
 * TOKEN_ENCRYPTION_KEY is deliberately not COOKIE_SECRET. Rotating the cookie secret
 * costs five minutes of in-flight logins; rotating this one without re-encrypting
 * first destroys every account link there is. Sharing one variable would give the
 * cheap secret the expensive secret's constraints, and nothing would fail loudly when
 * someone rotated it for a perfectly good reason.
 */

const PURPOSE = 'user-tokens.v1';

/**
 * Keys in the order they are tried, newest first.
 *
 * TOKEN_ENCRYPTION_KEY_OLD is how rotation happens without downtime: set it to the
 * current key, set a new current key, let the backfill re-seal everything, then remove
 * it. Without a second slot, rotating means taking the bot down and hoping.
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

/**
 * Fail at boot rather than at the first token write.
 *
 * Without this the read-both/write-encrypted path would start up happily and then
 * throw on the first refresh - or worse, if the write path were ever made tolerant,
 * write plaintext because it had nothing to encrypt with. Refusing to start is the
 * only safe answer to a missing key.
 */
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
 * Read a token column, whatever state it is in.
 *
 * A value that carries the envelope is decrypted; anything else is a row the backfill
 * has not reached yet and is returned as-is. That tolerance is the whole reason this
 * can be a backfill rather than a big-bang migration - and it is also why it must be
 * removed once the backfill is done, because until then a plaintext token is still
 * accepted silently.
 *
 * A sealed value that will not open returns null rather than throwing. That means one
 * user whose token was encrypted under a lost key is treated as unlinked and prompted
 * to link again, instead of every read of that row failing.
 */
export function openToken(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    if (!isSealed(value)) return value;
    return open(value, keys());
}

/** Whether a stored value still needs converting. Used by the backfill and its checks. */
export function needsSealing(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.length > 0 && !isSealed(value);
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
        if (column in out) out[column] = openToken(out[column] as string | null | undefined);
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
