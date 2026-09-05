import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertTokenKeyConfigured, needsResealing, needsSealing, openToken, openUserTokens, resealToken, sealToken, sealUserTokens } from '@nexusmods/persistence/tokenCrypto.js';

const KEY = 'DPB3vBrTKpBz0OYbBIdd0EJZAcMHGCJVCEr5Bd2fbwc=';
const OLD_KEY = 'k0Ky5oCr2hLhJZ1mnGXZlLKrz7XFBhKrhpNU0V1Ffyg=';
let saved: Record<string, string | undefined>;

beforeEach(() => {
    saved = { TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY, TOKEN_ENCRYPTION_KEY_OLD: process.env.TOKEN_ENCRYPTION_KEY_OLD };
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY_OLD;
});
afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

describe('configuration', () => {
    // Refusing to start is the only safe answer. A tolerant write path with no key
    // would write plaintext, which is worse than not deploying.
    it('throws when no key is configured', () => {
        delete process.env.TOKEN_ENCRYPTION_KEY;
        expect(() => assertTokenKeyConfigured()).toThrowError(expect.objectContaining({ code: 'CONFIG' }));
    });

    it('passes when the key round-trips', () => {
        expect(() => assertTokenKeyConfigured()).not.toThrow();
    });
});

describe('sealing tokens', () => {
    it('round-trips a token', () => {
        expect(openToken(sealToken('a-discord-access-token'))).toBe('a-discord-access-token');
    });

    it('does not store the token in readable form', () => {
        expect(sealToken('a-discord-access-token')).not.toContain('a-discord-access-token');
    });

    it('encrypts equal tokens to different values', () => {
        expect(sealToken('same')).not.toBe(sealToken('same'));
    });
});

describe('reading a column after the backfill', () => {
    // The tolerance that made this a backfill instead of a big bang is gone. These
    // tests are the inverse of the ones they replace: what used to be passed through
    // is now refused, because the census is zero and a plaintext value can only mean
    // something is writing tokens without sealing them.
    it('refuses a plaintext value rather than using it', () => {
        expect(() => openToken('a-token-that-was-never-sealed')).toThrow(/unencrypted/i);
    });

    it('refuses a JWT rather than treating it as sealed', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
        expect(() => openToken(jwt)).toThrow(/unencrypted/i);
    });

    it('names the column, and never the value, in what it throws', () => {
        // The message and context travel into logs and error reporting. A live
        // credential must not travel with them.
        const secret = 'super-secret-access-token';
        try {
            openToken(secret, 'nexus_access');
            throw new Error('should have thrown');
        }
        catch (err) {
            const dump = JSON.stringify({ message: (err as Error).message, err });
            expect(dump).toContain('nexus_access');
            expect(dump).not.toContain(secret);
        }
    });

    it('treats an empty string as no token, not as a fault', () => {
        // A nullable column legitimately holds nothing. Only a non-empty unsealed
        // value means something wrote a token without sealing it.
        expect(openToken('')).toBeNull();
    });

    it.each([null, undefined])('returns null for %s', (value) => {
        expect(openToken(value)).toBeNull();
    });

    // One unreadable row should make one user re-link, not break every read of it.
    it('returns null for a sealed value it cannot open, rather than throwing', () => {
        const sealed = sealToken('token');
        process.env.TOKEN_ENCRYPTION_KEY = OLD_KEY;
        expect(openToken(sealed)).toBeNull();
    });
});

describe('rotation', () => {
    it('opens values sealed under the previous key while both are set', () => {
        const underOld = sealToken('old-token');
        process.env.TOKEN_ENCRYPTION_KEY = OLD_KEY;
        process.env.TOKEN_ENCRYPTION_KEY_OLD = KEY;
        expect(openToken(underOld)).toBe('old-token');
    });

    it('seals under the current key, so rewritten rows move to it', () => {
        process.env.TOKEN_ENCRYPTION_KEY = OLD_KEY;
        process.env.TOKEN_ENCRYPTION_KEY_OLD = KEY;
        const fresh = sealToken('new-token');
        delete process.env.TOKEN_ENCRYPTION_KEY_OLD;
        expect(openToken(fresh)).toBe('new-token');
    });
});

describe('needsSealing', () => {
    it('is true for plaintext the backfill should convert', () => {
        expect(needsSealing('a-plaintext-token')).toBe(true);
    });

    it.each([null, undefined, ''])('is false for %s, which has nothing to protect', (value) => {
        expect(needsSealing(value)).toBe(false);
    });

    it('is false for something already sealed, so a re-run is a no-op', () => {
        expect(needsSealing(sealToken('token'))).toBe(false);
    });
});

describe('row helpers', () => {
    const row = () => ({
        d_id: '4242', name: 'Pickysaurus', supporter: false,
        nexus_access: 'na', nexus_refresh: 'nr', discord_access: 'da', discord_refresh: 'dr',
    });

    it('seals every token column and nothing else', () => {
        const sealed = sealUserTokens(row());
        for (const c of ['nexus_access', 'nexus_refresh', 'discord_access', 'discord_refresh'] as const) {
            expect(sealed[c]).toMatch(/^v1\./);
        }
        expect(sealed.name).toBe('Pickysaurus');
        expect(sealed.d_id).toBe('4242');
        expect(sealed.supporter).toBe(false);
    });

    it('round-trips a whole row', () => {
        expect(openUserTokens(sealUserTokens(row()))).toEqual(row());
    });

    // A partial update of the avatar must not acquire token columns it never had,
    // or buildUpdate would write nulls over live credentials.
    it('leaves a partial update without token columns alone', () => {
        const patch = { avatar_url: 'https://example.test/a.png' };
        expect(sealUserTokens(patch)).toEqual(patch);
        expect(Object.keys(sealUserTokens(patch))).toEqual(['avatar_url']);
    });

    it('seals only the columns present in a partial update', () => {
        const sealed = sealUserTokens({ nexus_access: 'na', nexus_expires: 1 });
        expect(sealed.nexus_access).toMatch(/^v1\./);
        expect(sealed.nexus_expires).toBe(1);
        expect('discord_access' in sealed).toBe(false);
    });

    it('does not double-seal a value that is already sealed', () => {
        const once = sealUserTokens({ nexus_access: 'na' });
        expect(sealUserTokens(once)).toEqual(once);
        expect(openUserTokens(sealUserTokens(once)).nexus_access).toBe('na');
    });

    it('does not mutate its argument', () => {
        const original = row();
        sealUserTokens(original);
        expect(original.nexus_access).toBe('na');
    });

    it('refuses a row with any unsealed token, naming the offending column', () => {
        const mixed = { nexus_access: sealToken('sealed-one'), discord_access: 'plaintext-one' };
        expect(() => openUserTokens(mixed)).toThrow(/discord_access/);
    });

    it.each([null, undefined])('leaves %s columns as they are', (value) => {
        expect(sealUserTokens({ nexus_access: value }).nexus_access).toBe(value);
    });
});

describe('key rotation', () => {
    /**
     * These exist because the original rotation procedure destroyed every link and
     * reported success while doing it. The backfill tested `needsSealing`, which is
     * false for an already-sealed value, so a rotation run skipped every row - and
     * removing the old key afterwards made all of them unreadable at once.
     */
    const sealedUnderOld = () => {
        process.env.TOKEN_ENCRYPTION_KEY = OLD_KEY;
        const value = sealToken('a-token');
        process.env.TOKEN_ENCRYPTION_KEY = KEY;
        process.env.TOKEN_ENCRYPTION_KEY_OLD = OLD_KEY;
        return value;
    };

    it('spots a value sealed under the old key', () => {
        expect(needsResealing(sealedUnderOld())).toBe(true);
    });

    it('does not flag a value already sealed under the current key', () => {
        process.env.TOKEN_ENCRYPTION_KEY_OLD = OLD_KEY;
        expect(needsResealing(sealToken('a-token'))).toBe(false);
    });

    it('is the test needsSealing could never be', () => {
        // The precise reason the rotation was silently a no-op.
        const value = sealedUnderOld();
        expect(needsSealing(value)).toBe(false);
        expect(needsResealing(value)).toBe(true);
    });

    it('flags nothing when no old key is configured', () => {
        // Nothing to rotate to, and a value that will not open under the only key there
        // is cannot be repaired - claiming otherwise would loop the backfill forever.
        const value = sealedUnderOld();
        delete process.env.TOKEN_ENCRYPTION_KEY_OLD;
        expect(needsResealing(value)).toBe(false);
    });

    it.each([null, undefined, '', 'plaintext'])('does not flag %s for re-sealing', (value) => {
        process.env.TOKEN_ENCRYPTION_KEY_OLD = OLD_KEY;
        expect(needsResealing(value)).toBe(false);
    });

    it('re-seals onto the current key, preserving the plaintext', () => {
        const old = sealedUnderOld();
        const fresh = resealToken(old)!;
        expect(fresh).not.toBe(old);
        // The point of the whole exercise: readable once the old key is gone.
        delete process.env.TOKEN_ENCRYPTION_KEY_OLD;
        expect(openToken(fresh)).toBe('a-token');
    });

    it('returns null rather than inventing a value it cannot decrypt', () => {
        const orphan = sealedUnderOld();
        process.env.TOKEN_ENCRYPTION_KEY_OLD = 'Zm9yZ290LXRoaXMta2V5LWVudGlyZWx5LTMyLWJ5dGVzIQ==';
        expect(resealToken(orphan)).toBeNull();
    });
});
