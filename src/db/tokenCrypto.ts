import { ConfigError, DatabaseError } from '../api/errors.js';
import { deriveKey, isSealed, open, seal } from '../lib/sealedValue.js';

/**
 * Encryption for the OAuth tokens in the users table.
 *
 * Four columns across ~37,000 rows held live Discord and Nexus Mods credentials in
 * plaintext until 4.3.0; they are all sealed now. What this protects against is narrow
 * and likely: **a copy of the database leaving without the droplet** - a backup downloaded to a laptop, a snapshot restored
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
 * TOKEN_ENCRYPTION_KEY_OLD lets both keys be accepted at once, which is half of what a
 * no-downtime rotation needs.
 *
 * **The other half does not exist yet, and the obvious procedure silently destroys every
 * link.** Set OLD to the current key, set a new current key, redeploy, and reads keep
 * working - because both keys are tried. But running the backfill at that point converts
 * nothing: it seals values where `needsSealing` is true, and a value already sealed under
 * the old key is not one of those, so it is skipped and reported as success. Remove
 * TOKEN_ENCRYPTION_KEY_OLD after that and every row becomes unreadable at once - each one
 * returning null, which reads downstream as "this user is not linked".
 *
 * Verified against a real database: a rotation run reports `converted: 0, skipped: 2`,
 * leaves the ciphertext byte-identical, and the new key alone then reads null.
 *
 * Rotating safely needs a re-seal pass - open under whichever key works, seal under the
 * current one - keyed on "does this open under the current key alone?" rather than on
 * `needsSealing`. Until that exists, do not remove TOKEN_ENCRYPTION_KEY_OLD once set.
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
 * Read a token column.
 *
 * Until the 4.3.0 backfill ran, an unsealed value was passed through untouched - that
 * tolerance is what let the conversion be gradual rather than a big-bang migration.
 * **It is gone.** The census is zero on all four columns, so a plaintext value now means
 * something is writing tokens that does not go through `sealUserTokens`, and passing it
 * through would be silently accepting the exact state this work removed.
 *
 * Throwing is safe here because every caller already degrades sensibly: `getUserBy*` in
 * api/users.ts wrap construction in a try and return `undefined`, so the user is treated
 * as unlinked and prompted to link again, and `getAllUsers` has one caller which already
 * falls back to an empty list. The recovery path if it ever fires is
 * `npm run tokens:backfill`, which seals whatever it finds.
 *
 * Null and empty are not tolerance - they are the absence of a token, which is a real
 * state for a nullable column. Only a non-empty value that is not sealed is a fault.
 *
 * A sealed value that will not open still returns null rather than throwing. That is
 * deliberate and different: one user whose token was sealed under a lost key is treated
 * as unlinked, instead of every read of that row failing.
 */
export function openToken(value: string | null | undefined, column: string = 'token'): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (!isSealed(value)) {
        // The value itself is never logged or attached as context - it is a live
        // credential, and the four column names are redaction keys in the logger for
        // exactly this reason.
        throw new DatabaseError(`Refusing to use an unencrypted value from ${column}`, {
            context: { column, hint: 'Run `npm run tokens:verify` to count, then `npm run tokens:backfill` to seal.' },
            isOperational: false,
            userMessage: 'Your linked account could not be read. Please link it again.',
        });
    }
    return open(value, keys());
}

/**
 * Whether a stored value still needs converting.
 *
 * Retained after the backfill because `sealUserTokens` uses it on every write - it is
 * what seals a freshly issued token on its way in - and because the CLI backfill is the
 * recovery path if `openToken` ever throws.
 */
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
