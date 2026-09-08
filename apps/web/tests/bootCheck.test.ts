import { describe, it, expect } from 'vitest';
import { inspectEnvironment } from '@/lib/bootCheck';

/**
 * The decision, without starting a server. runBootCheck's only other job is to log it and
 * call process.exit, which is exercised for real by starting the app without the secrets -
 * see the commit message.
 */
const base = { COOKIE_SECRET: 'a', UNLINK_SECRET: 'b', DISCORD_TOKEN: 'e', AUTOMOD_AUTHCODE: 'c', ADMIN_AUTHCODE: 'd' };

describe('the environment the site needs', () => {
    it('is happy when everything is set', () => {
        expect(inspectEnvironment({ ...base, NODE_ENV: 'production', TRUST_PROXY: '1' }))
            .toEqual({ missing: [], unguarded: [], proxyUnknown: false });
    });

    it('names every missing required secret, not just the first', () => {
        const problems = inspectEnvironment({});
        expect(problems.missing.map((m) => m.name)).toEqual(['COOKIE_SECRET', 'UNLINK_SECRET', 'DISCORD_TOKEN']);
        // The reason travels with the name so the log line can say what it was for.
        expect(problems.missing[0].reason).toContain('state cookie');
    });

    it('treats the shared secrets as optional but reports them', () => {
        // Absent means those endpoints reject everything, which is the fail-closed
        // behaviour - but silently rejecting everything is worth a line in the log.
        const problems = inspectEnvironment({ COOKIE_SECRET: 'a', UNLINK_SECRET: 'b', DISCORD_TOKEN: 'e' });
        expect(problems.missing).toEqual([]);
        expect(problems.unguarded).toEqual(['AUTOMOD_AUTHCODE', 'ADMIN_AUTHCODE']);
    });

    it('notices an unset TRUST_PROXY in production and only in production', () => {
        expect(inspectEnvironment({ ...base, NODE_ENV: 'production' }).proxyUnknown).toBe(true);
        expect(inspectEnvironment({ ...base, NODE_ENV: 'development' }).proxyUnknown).toBe(false);
        expect(inspectEnvironment({ ...base }).proxyUnknown).toBe(false);
    });
});
