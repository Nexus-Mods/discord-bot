import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';

/**
 * The account link, driven end to end through a real listening server with a cookie jar.
 *
 * The unit tests cover the sealing. This covers the wiring, which is where the mistakes
 * actually happen: the first version of this change read the cookie from `req.cookies`
 * instead of `req.signedCookies`, which type-checks, passes every unit test, and 403s
 * every real link. Only a test that drives the flow catches that.
 */
const DISCORD_TOKENS = { access_token: 'D'.repeat(30), refresh_token: 'DR'.repeat(15), expires_at: 1_900_000_000_000 };
const NEXUS_TOKENS = { access_token: 'N'.repeat(30), refresh_token: 'NR'.repeat(15), expires_at: 1_900_000_000_000 };
let created: Record<string, unknown> | null = null;

// The rate limiter is switched off here, and finding that out was worth the detour.
// `sensitiveLimit` is one limiter instance shared by /linked-role, both OAuth callbacks,
// /revoke and the two metadata endpoints - express-rate-limit counts per key per
// instance, not per route - so a single IP gets 10 requests a minute across all of them,
// and one completed link spends three. These tests exhaust it in the third case.
vi.mock('express-rate-limit', () => ({
    default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../src/server/DiscordOAuth.js', () => ({
    getOAuthUrl: () => { const state = crypto.randomBytes(16).toString('base64url'); return { url: `https://discord.test/authorize?state=${state}`, state }; },
    getOAuthTokens: async () => DISCORD_TOKENS,
    getUserData: async () => ({ user: { id: '4242', username: 'mike', discriminator: '0' } }),
    revoke: async () => undefined,
}));

vi.mock('../../src/server/NexusModsOAuth.js', () => ({
    getOAuthUrl: (state: string) => ({ url: `https://nexus.test/authorize?state=${state}` }),
    getOAuthTokens: async () => NEXUS_TOKENS,
    getUserData: async () => ({ sub: '31179975', name: 'Pickysaurus', avatar: '', membership_roles: ['premium'] }),
    revoke: async () => undefined,
}));

vi.mock('../../src/api/users.js', () => ({
    getUserByDiscordId: async () => undefined,
    getUserByNexusModsId: async () => undefined,
    deleteUser: async () => undefined,
    updateUser: async () => ({}),
    createUser: async (u: Record<string, unknown>) => {
        created = u;
        return { DiscordId: u.d_id, NexusModsUsername: u.name,
            Discord: { PushMetaData: async () => undefined, GetRemoteMetaData: async () => ({}) },
            NexusMods: { Auth: async () => undefined, Refresh: async () => undefined } };
    },
}));

const PORT = 31556;
const BASE = `http://127.0.0.1:${PORT}`;
let site: { close(): Promise<void> };

beforeAll(async () => {
    process.env.COOKIE_SECRET = 'integration-cookie-secret-0123456789';
    process.env.UNLINK_SECRET = 'integration-unlink-secret';
    process.env.AUTH_PORT = String(PORT);
    process.env.NODE_ENV = 'testing';
    const { AuthSite } = await import('../../src/server/server.js');
    const noop = () => undefined;
    const logger = { info: noop, warn: noop, error: noop, debug: noop } as any;
    site = AuthSite.getInstance({ guild: async () => null, channels: async () => [] } as any, logger);
    await new Promise((r) => setTimeout(r, 250));
});
afterAll(async () => { await site?.close(); });

/** A browser: keeps cookies, honours Set-Cookie deletions, does not follow redirects. */
function browser() {
    const jar = new Map<string, string>();
    return {
        jar,
        async go(path: string) {
            const res = await fetch(BASE + path, {
                redirect: 'manual',
                headers: jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {},
            });
            for (const c of res.headers.getSetCookie()) {
                const [pair] = c.split(';');
                const i = pair.indexOf('=');
                const name = pair.slice(0, i);
                const value = pair.slice(i + 1);
                if (value === '') jar.delete(name); else jar.set(name, value);
            }
            return res;
        },
    };
}

async function startLink(b: ReturnType<typeof browser>) {
    const res = await b.go('/linked-role');
    const location = res.headers.get('location');
    if (!location) throw new Error(`/linked-role returned ${res.status}, remaining=${res.headers.get('ratelimit-remaining')}`);
    return new URL(location).searchParams.get('state')!;
}

describe('the account link survives having no server-side state', () => {
    it('completes, and writes both token sets', async () => {
        created = null;
        const b = browser();
        const state = await startLink(b);
        expect(b.jar.has('clientState')).toBe(true);

        const discord = await b.go(`/discord-oauth-callback?code=abc&state=${encodeURIComponent(state)}`);
        expect(discord.status).toBe(302);
        expect(discord.headers.get('location')).toContain('nexus.test');
        const sealed = b.jar.get('linkState');
        expect(sealed).toBeTruthy();

        // The property the whole design rests on: the browser is holding the Discord
        // tokens, and cannot read them.
        expect(decodeURIComponent(sealed!)).not.toContain(DISCORD_TOKENS.access_token);
        expect(decodeURIComponent(sealed!)).not.toContain(DISCORD_TOKENS.refresh_token);

        const nexus = await b.go(`/nexus-mods-callback?code=xyz&state=${encodeURIComponent(state)}`);
        expect(nexus.status).toBe(302);
        expect(nexus.headers.get('location')).toContain('/success');
        expect(created).toMatchObject({
            d_id: '4242',
            discord_access: DISCORD_TOKENS.access_token,
            nexus_access: NEXUS_TOKENS.access_token,
        });

        // Read once: the cookie is cleared on the way out.
        expect(b.jar.has('linkState')).toBe(false);
    });

    it('rejects the Nexus callback when the Discord half never happened', async () => {
        created = null;
        const b = browser();
        const state = await startLink(b);
        const res = await b.go(`/nexus-mods-callback?code=xyz&state=${encodeURIComponent(state)}`);
        expect(res.status).toBe(403);
        expect(created).toBeNull();
    });

    // The state binding, exercised through the wire rather than the unit.
    it('rejects a linkState cookie captured from a different link attempt', async () => {
        created = null;
        const victim = browser();
        const victimState = await startLink(victim);
        await victim.go(`/discord-oauth-callback?code=abc&state=${encodeURIComponent(victimState)}`);
        const stolen = victim.jar.get('linkState')!;

        const attacker = browser();
        const attackerState = await startLink(attacker);
        attacker.jar.set('linkState', stolen);
        const res = await attacker.go(`/nexus-mods-callback?code=xyz&state=${encodeURIComponent(attackerState)}`);
        expect(res.status).toBe(403);
        expect(created).toBeNull();
    });

    it('rejects a forged linkState cookie', async () => {
        created = null;
        const b = browser();
        const state = await startLink(b);
        b.jar.set('linkState', 'v1.AAAA.BBBB.CCCC');
        const res = await b.go(`/nexus-mods-callback?code=xyz&state=${encodeURIComponent(state)}`);
        expect(res.status).toBe(403);
        expect(created).toBeNull();
    });

    // What the old Map could not do: a second process, or the same one after a restart,
    // finishes a link it never started.
    it('is completed by a server that has no memory of starting it', async () => {
        created = null;
        const b = browser();
        const state = await startLink(b);
        await b.go(`/discord-oauth-callback?code=abc&state=${encodeURIComponent(state)}`);

        // Nothing is carried over between requests, so a restart is indistinguishable
        // from any other request as far as the flow is concerned.
        const res = await b.go(`/nexus-mods-callback?code=xyz&state=${encodeURIComponent(state)}`);
        expect(res.status).toBe(302);
        expect(created).not.toBeNull();
    });
});
