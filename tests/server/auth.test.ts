import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type express from 'express';
import { safeCompare, signValue, verifyValue, checkSharedSecret, cookieOptions, unlinkUrl } from '../../src/server/auth.js';

const SECRET = 'test-unlink-secret';

/**
 * These cover S2 and S1 from the Phase 0 audit. A regression here re-opens
 * unauthenticated account deletion and unauthenticated writes to the automod rules
 * table, so they are the highest-value tests in the suite.
 */

describe('signValue / verifyValue', () => {
    it('accepts a token for the id it was signed with', () => {
        const token = signValue('12345', 60_000, SECRET);
        expect(verifyValue('12345', token, SECRET)).toBe(true);
    });

    it('rejects a token presented for a different id', () => {
        // The whole point of S2: an attacker editing ?id= in the unlink URL.
        const token = signValue('12345', 60_000, SECRET);
        expect(verifyValue('99999', token, SECRET)).toBe(false);
    });

    it('rejects a token signed with a different secret', () => {
        const token = signValue('12345', 60_000, 'other-secret');
        expect(verifyValue('12345', token, SECRET)).toBe(false);
    });

    it('rejects an expired token', () => {
        const token = signValue('12345', -1, SECRET);
        expect(verifyValue('12345', token, SECRET)).toBe(false);
    });

    it('rejects a token whose expiry has been extended', () => {
        const token = signValue('12345', 60_000, SECRET);
        const signature = token.split('.')[1];
        const forged = `${Date.now() + 9_000_000}.${signature}`;
        expect(verifyValue('12345', forged, SECRET)).toBe(false);
    });

    it.each([undefined, '', 'garbage', 'no-dot', '.', 'abc.def', `${Date.now() + 1000}.`])(
        'rejects the malformed token %j',
        (token) => {
            expect(verifyValue('12345', token as string | undefined, SECRET)).toBe(false);
        },
    );
});

describe('safeCompare', () => {
    it('matches identical strings', () => {
        expect(safeCompare('abc', 'abc')).toBe(true);
    });

    it('rejects different strings of equal length', () => {
        expect(safeCompare('abc', 'abd')).toBe(false);
    });

    it('rejects different lengths without throwing', () => {
        // crypto.timingSafeEqual throws on a length mismatch, so this must be
        // guarded before it is called.
        expect(() => safeCompare('a', 'abcdef')).not.toThrow();
        expect(safeCompare('a', 'abcdef')).toBe(false);
    });
});

describe('checkSharedSecret', () => {
    const req = (authorization?: string) =>
        ({ headers: authorization === undefined ? {} : { authorization } }) as unknown as express.Request;

    beforeEach(() => { process.env.TEST_AUTHCODE = 'correct-horse'; });
    afterEach(() => { delete process.env.TEST_AUTHCODE; });

    it('accepts the correct header', () => {
        expect(checkSharedSecret(req('correct-horse'), 'TEST_AUTHCODE')).toBe(true);
    });

    it('rejects a wrong header', () => {
        // The original returned true here, so a wrong header passed and the correct
        // one got a 401.
        expect(checkSharedSecret(req('wrong'), 'TEST_AUTHCODE')).toBe(false);
    });

    it('rejects a missing header', () => {
        expect(checkSharedSecret(req(), 'TEST_AUTHCODE')).toBe(false);
        expect(checkSharedSecret(req(''), 'TEST_AUTHCODE')).toBe(false);
    });

    it('fails closed when the secret is not configured', () => {
        delete process.env.TEST_AUTHCODE;
        expect(checkSharedSecret(req('anything'), 'TEST_AUTHCODE')).toBe(false);
        expect(checkSharedSecret(req(), 'TEST_AUTHCODE')).toBe(false);
    });
});

describe('cookieOptions', () => {
    const original = process.env.NODE_ENV;
    afterEach(() => { process.env.NODE_ENV = original; });

    it('is httpOnly, signed and lax in every environment', () => {
        const opts = cookieOptions(1000);
        expect(opts).toMatchObject({ maxAge: 1000, signed: true, httpOnly: true, sameSite: 'lax' });
    });

    it('sets secure only in production', () => {
        process.env.NODE_ENV = 'development';
        expect(cookieOptions(1000).secure).toBe(false);
        process.env.NODE_ENV = 'production';
        expect(cookieOptions(1000).secure).toBe(true);
    });
});

describe('unlinkUrl', () => {
    const original = { secret: process.env.UNLINK_SECRET, base: process.env.SITE_BASE_URL };
    afterEach(() => {
        process.env.UNLINK_SECRET = original.secret;
        process.env.SITE_BASE_URL = original.base;
    });

    it('produces a URL whose token verifies for that discord id', () => {
        process.env.UNLINK_SECRET = SECRET;
        process.env.SITE_BASE_URL = 'https://example.test';
        const url = new URL(unlinkUrl('4242'));
        expect(url.origin + url.pathname).toBe('https://example.test/revoke');
        expect(url.searchParams.get('id')).toBe('4242');
        expect(verifyValue('4242', url.searchParams.get('token') ?? undefined, SECRET)).toBe(true);
    });

    it('omits the token entirely when no secret is configured', () => {
        delete process.env.UNLINK_SECRET;
        expect(unlinkUrl('4242')).not.toContain('token=');
    });
});
