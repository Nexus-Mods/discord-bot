import { describe, it, expect } from 'vitest';
import { scrub } from '@nexusmods/core/logger.js';

/**
 * The old logger printed whatever it was handed. dbConnect logged the pg bind array
 * - which for createUser and updateUser IS the OAuth token array - and users.ts
 * logged an entire DiscordBotUser. These are the exact shapes that leaked.
 */
describe('scrub', () => {
    it('redacts the pg bind array, which carries tokens on user writes', () => {
        const out = scrub({ query: 'INSERT INTO users ...', values: ['mike', 'nexus_tok_SECRET', 'refresh_SECRET'] }) as Record<string, unknown>;
        expect(out.values).toBe('[redacted]');
        expect(out.query).toBe('INSERT INTO users ...');
        expect(JSON.stringify(out)).not.toContain('SECRET');
    });

    it.each(['nexus_access', 'nexus_refresh', 'discord_access', 'discord_refresh', 'access_token', 'refresh_token', 'apikey', 'password', 'clientSecret', 'Authorization', 'Cookie'])(
        'redacts the key %s',
        (key) => {
            const out = scrub({ [key]: 'SECRET' }) as Record<string, unknown>;
            expect(out[key]).toBe('[redacted]');
        },
    );

    it('redacts nested token objects on a user record', () => {
        const out = scrub({
            user: { name: 'Mike', nexus_access: 'A', NexusModsOAuthTokens: { access_token: 'B' } },
        });
        expect(JSON.stringify(out)).not.toContain('"A"');
        expect(JSON.stringify(out)).not.toContain('"B"');
        expect(JSON.stringify(out)).toContain('Mike');
    });

    it('keeps values that merely sit next to a secret', () => {
        const out = scrub({ headers: { Authorization: 'Bearer x', 'Application-Name': 'bot' } }) as Record<string, Record<string, unknown>>;
        expect(out.headers.Authorization).toBe('[redacted]');
        expect(out.headers['Application-Name']).toBe('bot');
    });

    it('handles a cycle instead of overflowing the stack', () => {
        const cyclic: Record<string, unknown> = { a: 1 };
        cyclic.self = cyclic;
        expect(() => scrub(cyclic)).not.toThrow();
        expect((scrub(cyclic) as Record<string, unknown>).self).toBe('[circular]');
    });

    it('caps depth rather than walking an arbitrarily deep object', () => {
        let deep: Record<string, unknown> = { end: true };
        for (let i = 0; i < 20; i++) deep = { next: deep };
        expect(JSON.stringify(scrub(deep))).toContain('[max depth reached]');
    });

    it('leaves primitives and arrays of primitives alone', () => {
        expect(scrub('hello')).toBe('hello');
        expect(scrub(42)).toBe(42);
        expect(scrub(null)).toBe(null);
        expect(scrub([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('serialises an Error rather than emptying it', () => {
        const out = scrub(new Error('kaboom')) as Record<string, unknown>;
        expect(out.message).toBe('kaboom');
        expect(out.stack).toContain('logger.test');
    });
});
