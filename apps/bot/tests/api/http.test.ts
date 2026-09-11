import { describe, it, expect, vi, afterEach } from 'vitest';
import { readJson, expiresAt } from '@nexusmods/core/http.js';

describe('expiresAt', () => {
    afterEach(() => vi.useRealTimers());

    it('adds the lifetime in seconds to now', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        expect(expiresAt(3600)).toBe(Date.parse('2026-01-01T01:00:00Z'));
    });

    it('treats a missing expires_in as already expired, not NaN', () => {
        // The bug this replaces: Date.now() + undefined * 1000 is NaN, and every
        // comparison against NaN is false - so `Date.now() > expires_at` never fired
        // and a token that arrived without expires_in was never refreshed.
        const result = expiresAt(undefined);
        expect(Number.isNaN(result)).toBe(false);
        expect(Date.now() > result - 1).toBe(true);
    });

    it('handles zero', () => {
        expect(Number.isNaN(expiresAt(0))).toBe(false);
    });
});

describe('readJson', () => {
    it('returns the parsed body', async () => {
        const response = { json: async () => ({ access_token: 'abc' }) } as unknown as Response;
        await expect(readJson<{ access_token: string }>(response)).resolves.toEqual({ access_token: 'abc' });
    });

    it('propagates a parse failure rather than returning undefined', async () => {
        const response = { json: async () => { throw new SyntaxError('Unexpected token <'); } } as unknown as Response;
        await expect(readJson(response)).rejects.toThrow(SyntaxError);
    });
});
