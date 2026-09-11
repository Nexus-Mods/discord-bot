import { describe, it, expect } from 'vitest';
import { inspectEnvironment } from '@/lib/bootCheck';

/**
 * The decision, without starting a server. runBootCheck's only other job is to log it and
 * call process.exit, which is exercised for real by starting the app without the secrets -
 * see the commit message.
 */
const base = { COOKIE_SECRET: 'a', UNLINK_SECRET: 'b', DISCORD_TOKEN: 'e', DBPORT: '5432', AUTOMOD_AUTHCODE: 'c', ADMIN_AUTHCODE: 'd', FORUM_WEBHOOK_SECRET: 'f' };

describe('the environment the site needs', () => {
    it('is happy when everything is set', () => {
        expect(inspectEnvironment({ ...base, NODE_ENV: 'production', TRUST_PROXY: '1' }))
            .toEqual({ missing: [], unguarded: [], proxyUnknown: false });
    });

    it('names every missing required secret, not just the first', () => {
        const problems = inspectEnvironment({});
        expect(problems.missing.map((m) => m.name)).toEqual(['COOKIE_SECRET', 'UNLINK_SECRET', 'DISCORD_TOKEN', 'DBPORT']);
        // The reason travels with the name so the log line can say what it was for.
        expect(problems.missing[0].reason).toContain('state cookie');
    });

    it('treats the shared secrets as optional but reports them', () => {
        // Absent means those endpoints reject everything, which is the fail-closed
        // behaviour - but silently rejecting everything is worth a line in the log.
        const problems = inspectEnvironment({ COOKIE_SECRET: 'a', UNLINK_SECRET: 'b', DISCORD_TOKEN: 'e', DBPORT: '5432' });
        expect(problems.missing).toEqual([]);
        expect(problems.unguarded).toEqual(['AUTOMOD_AUTHCODE', 'ADMIN_AUTHCODE', 'FORUM_WEBHOOK_SECRET']);
    });

    it('notices an unset TRUST_PROXY in production and only in production', () => {
        expect(inspectEnvironment({ ...base, NODE_ENV: 'production' }).proxyUnknown).toBe(true);
        expect(inspectEnvironment({ ...base, NODE_ENV: 'development' }).proxyUnknown).toBe(false);
        expect(inspectEnvironment({ ...base }).proxyUnknown).toBe(false);
    });
});

/**
 * The collision that would have broken the switch to the Next container.
 *
 * The database port is `DBPORT ?? PORT`, and the Next server reads PORT to decide what to
 * listen on - so a web container told to serve on 3000 would have pointed its database
 * client at port 3000 as well. It would have started, served pages, and failed every
 * query.
 */
describe('DBPORT, because PORT means the HTTP port here', () => {
    it('refuses to start without it', () => {
        const { DBPORT, ...withoutIt } = base;
        expect(DBPORT).toBeTruthy();
        const problems = inspectEnvironment({ ...withoutIt, PORT: '3000' });
        expect(problems.missing.map((m) => m.name)).toContain('DBPORT');
        expect(problems.missing.find((m) => m.name === 'DBPORT')?.reason).toMatch(/HTTP port/);
    });

    it('refuses even when PORT alone would have given the right answer', () => {
        // The repository's own .env is PORT=5432 with no DBPORT, which works by luck in
        // the bot. Luck is not a configuration, and this process cannot tell the two
        // meanings apart.
        const withoutIt = { ...base, DBPORT: undefined };
        expect(inspectEnvironment({ ...withoutIt, PORT: '5432' }).missing.map((m) => m.name)).toContain('DBPORT');
    });

    it('is satisfied by the one line .env.example already carries', () => {
        expect(inspectEnvironment({ ...base, PORT: '3000' }).missing).toEqual([]);
    });
});
