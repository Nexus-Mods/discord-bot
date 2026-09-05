import { describe, it, expect } from 'vitest';
import { deriveKey, isSealed, open, seal } from '@nexusmods/core/sealedValue.js';

const key = deriveKey('a-secret-of-realistic-length-0123456789', 'test.v1');
const other = deriveKey('a-different-secret-entirely-9876543210', 'test.v1');

describe('deriveKey', () => {
    it('is deterministic, or nothing sealed yesterday opens today', () => {
        expect(deriveKey('s', 'p').equals(deriveKey('s', 'p'))).toBe(true);
    });

    // The property that lets one secret serve several jobs without them being able to
    // read each other - the cookie secret seals link state and nothing else.
    it('gives unrelated keys for different purposes from the same secret', () => {
        expect(deriveKey('s', 'link-state.v1').equals(deriveKey('s', 'user-tokens.v1'))).toBe(false);
    });

    it('refuses an empty secret rather than deriving from nothing', () => {
        expect(() => deriveKey('', 'p')).toThrow();
    });
});

describe('seal and open', () => {
    it('round-trips', () => {
        expect(open(seal('a-token-value', key), [key])).toBe('a-token-value');
    });

    it('round-trips unicode and empty strings', () => {
        for (const value of ['', 'ünïcødé ✓', 'a'.repeat(4096)]) {
            expect(open(seal(value, key), [key])).toBe(value);
        }
    });

    it('produces a different ciphertext every time, so equal values are not equal columns', () => {
        expect(seal('same', key)).not.toBe(seal('same', key));
    });

    it('does not leak the plaintext into the envelope', () => {
        expect(seal('super-secret-token', key)).not.toContain('super-secret-token');
    });
});

describe('rejection', () => {
    it.each([
        ['the wrong key', () => seal('v', other)],
        ['a tampered ciphertext', () => seal('v', key).slice(0, -4) + 'AAAA'],
        ['a tampered auth tag', () => { const p = seal('v', key).split('.'); p[2] = 'AAAAAAAAAAAAAAAAAAAAAA'; return p.join('.'); }],
        ['a plaintext value', () => 'not-sealed-at-all'],
        ['an empty string', () => ''],
        ['a JWT, which has three segments rather than four', () => 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl'],
        ['a non-string', () => 12345],
        ['null', () => null],
    ])('returns null for %s', (_label, make) => {
        expect(open(make(), [key])).toBeNull();
    });

    // The version sits outside the authenticated data - it has to, because it selects
    // how to authenticate - so anyone can change it. Refusing an unknown version is
    // what stops a future format being fed to this one's decryption.
    it('refuses a version it does not understand, even with the right key', () => {
        const sealed = seal('v', key);
        expect(open('v2' + sealed.slice(2), [key])).toBeNull();
    });
});

describe('key rotation', () => {
    // Why open() takes a list: during rotation both old and new values must open.
    it('opens a value sealed under either key while both are configured', () => {
        const underOld = seal('old-value', other);
        const underNew = seal('new-value', key);
        expect(open(underOld, [key, other])).toBe('old-value');
        expect(open(underNew, [key, other])).toBe('new-value');
    });

    it('stops opening old values once the old key is dropped', () => {
        expect(open(seal('old-value', other), [key])).toBeNull();
    });

    it('seals under the first key, so rotation moves forward as rows are rewritten', () => {
        const keysInUse = [key, other];
        expect(open(seal('v', keysInUse[0]), [key])).toBe('v');
    });
});

describe('isSealed', () => {
    it('recognises the envelope', () => {
        expect(isSealed(seal('v', key))).toBe(true);
    });

    // What makes this a backfill rather than a big bang: a column can hold both.
    it.each(['a-plaintext-oauth-token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln', '', 'v1.only.three'])(
        'does not mistake %s for a sealed value', (value) => {
            expect(isSealed(value)).toBe(false);
        });

    // Broader than open() on purpose: "has this been encrypted" stays true for a
    // future v2, so a backfill would not try to re-seal it.
    it('recognises a future version as sealed even though open would refuse it', () => {
        const future = 'v2' + seal('v', key).slice(2);
        expect(isSealed(future)).toBe(true);
        expect(open(future, [key])).toBeNull();
    });
});
