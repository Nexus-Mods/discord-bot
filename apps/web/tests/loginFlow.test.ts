import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signCookieValue, unsignCookieValue } from '@/lib/security/signedCookies';
import { openSession } from '@nexusmods/auth/session.js';
import { SESSION_COOKIE } from '@nexusmods/auth/session.js';

/**
 * The three requests signing in is made of, driven by calling the exported handlers with a
 * hand-built Request - no server, no port, so a failure here is the handler's.
 *
 * Mostly the refusals. A login callback that accepts a state it did not issue is a login
 * callback that signs the wrong person in.
 */

const COOKIE_SECRET = 'test-cookie-secret';
const STATE = '11111111-2222-3333-4444-555555555555';

vi.mock('@nexusmods/core/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@nexusmods/auth/discordLogin.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@nexusmods/auth/discordLogin.js')>();
    return {
        ...actual,
        exchangeLoginCode: vi.fn(async () => ({ access_token: 'login-access-token' })),
        fetchSelf: vi.fn(async () => ({ id: '1234567890', username: 'someone', global_name: 'Someone', avatar: 'hash' })),
        revokeLoginToken: vi.fn(async () => undefined),
    };
});

const { GET: login } = await import('@/app/login/route');
const { GET: callback } = await import('@/app/login/callback/route');
const { POST: logout } = await import('@/app/logout/route');
const DiscordLogin = await import('@nexusmods/auth/discordLogin.js');

function request(path: string, cookies: Record<string, string> = {}, init: RequestInit = {}): Request {
    const header = Object.entries(cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
    const headers = { ...(header ? { cookie: header } : {}), ...(init.headers as Record<string, string> ?? {}) };
    return new Request(`https://discordbot.nexusmods.test${path}`, { ...init, headers });
}

const signed = (value: string) => signCookieValue(value, COOKIE_SECRET);

function rawCookie(response: Response, name: string): string | undefined {
    for (const line of response.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const eq = pair.indexOf('=');
        if (pair.slice(0, eq).trim() !== name) continue;
        return decodeURIComponent(pair.slice(eq + 1));
    }
    return undefined;
}

function setCookieLine(response: Response, name: string): string | undefined {
    return response.headers.getSetCookie().find((line) => line.startsWith(`${name}=`));
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.COOKIE_SECRET = COOKIE_SECRET;
    process.env.DISCORD_CLIENT_ID = 'client-id';
    process.env.DISCORD_CLIENT_SECRET = 'client-secret';
    process.env.DISCORD_LOGIN_REDIRECT_URI = 'https://discordbot.nexusmods.test/login/callback';
    process.env.SITE_BASE_URL = 'https://discordbot.nexusmods.test';
});

afterEach(() => {
    delete process.env.DISCORD_LOGIN_REDIRECT_URI;
});

describe('GET /login', () => {
    it('sends the user to Discord and remembers the state in a signed cookie', async () => {
        const response = await login();

        expect(response.status).toBe(302);
        const location = response.headers.get('location')!;
        expect(location).toContain('https://discord.com/api/oauth2/authorize');

        const url = new URL(location);
        const state = url.searchParams.get('state');
        const cookie = unsignCookieValue(rawCookie(response, 'loginState'), COOKIE_SECRET);
        expect(state).toBeTruthy();
        expect(cookie).toBe(state);
    });

    it('asks for identify and guilds, and nothing the link flow asks for', async () => {
        const url = new URL((await login()).headers.get('location')!);
        expect(url.searchParams.get('scope')).toBe('identify guilds');
        // Adding guilds to the link flow would show every existing user a new consent
        // screen mid-link. This is a separate request for that reason.
        expect(url.searchParams.get('scope')).not.toContain('role_connections.write');
    });

    it('uses its own redirect URI, not the link flow\'s', async () => {
        process.env.DISCORD_REDIRECT_URI = 'https://discordbot.nexusmods.test/discord-oauth-callback';
        const url = new URL((await login()).headers.get('location')!);
        expect(url.searchParams.get('redirect_uri')).toBe('https://discordbot.nexusmods.test/login/callback');
    });

    it('is unavailable when no login redirect URI is registered', async () => {
        delete process.env.DISCORD_LOGIN_REDIRECT_URI;
        const response = await login();
        expect(response.headers.get('location')).toBe('/oauth-error');
    });
});

describe('GET /login/callback', () => {
    it('signs the user in when the state matches', async () => {
        const response = await callback(
            request(`/login/callback?code=abc&state=${STATE}`, { loginState: signed(STATE) }),
        );

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('/me');

        const session = openSession(rawCookie(response, SESSION_COOKIE), COOKIE_SECRET);
        expect(session).toMatchObject({ id: '1234567890', name: 'Someone', accessToken: 'login-access-token' });
    });

    it('clears the state cookie once it has been spent', async () => {
        const response = await callback(
            request(`/login/callback?code=abc&state=${STATE}`, { loginState: signed(STATE) }),
        );
        expect(setCookieLine(response, 'loginState')).toContain('Max-Age=0');
    });

    it('sets the session cookie httpOnly and lax', async () => {
        const response = await callback(
            request(`/login/callback?code=abc&state=${STATE}`, { loginState: signed(STATE) }),
        );
        const line = setCookieLine(response, SESSION_COOKIE)!;
        expect(line).toContain('HttpOnly');
        expect(line).toMatch(/SameSite=lax/i);
    });

    it.each([
        ['no cookie', {}, `/login/callback?code=abc&state=${STATE}`],
        ['a cookie for another state', { loginState: '22222222-0000-0000-0000-000000000000' }, `/login/callback?code=abc&state=${STATE}`],
        ['an unsigned cookie', { loginState: STATE }, `/login/callback?code=abc&state=${STATE}`],
        ['no state in the URL', { loginState: STATE }, '/login/callback?code=abc'],
    ])('refuses %s with a 403 and no session', async (_label, cookies, path) => {
        const response = await callback(request(path, cookies as Record<string, string>));
        expect(response.status).toBe(403);
        expect(rawCookie(response, SESSION_COOKIE)).toBeUndefined();
        expect(DiscordLogin.exchangeLoginCode).not.toHaveBeenCalled();
    });

    it('will not complete a link flow\'s state', async () => {
        // The two flows use different cookie names on purpose: a clientState captured
        // from a link must not finish a login.
        const response = await callback(
            request(`/login/callback?code=abc&state=${STATE}`, { clientState: signed(STATE) }),
        );
        expect(response.status).toBe(403);
    });

    it('sends the user home when they press Cancel', async () => {
        const response = await callback(request('/login/callback?error=access_denied&state=x'));
        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('/');
        expect(rawCookie(response, SESSION_COOKIE)).toBeUndefined();
    });

    it('errors rather than signing anyone in when Discord returns no code', async () => {
        const response = await callback(request(`/login/callback?state=${STATE}`, { loginState: signed(STATE) }));
        expect(response.headers.get('location')).toBe('/oauth-error');
        expect(rawCookie(response, SESSION_COOKIE)).toBeUndefined();
    });

    it('falls back to the username when there is no display name', async () => {
        vi.mocked(DiscordLogin.fetchSelf).mockResolvedValueOnce(
            { id: '7', username: 'plainname', global_name: null, avatar: null },
        );
        const response = await callback(
            request(`/login/callback?code=abc&state=${STATE}`, { loginState: signed(STATE) }),
        );
        expect(openSession(rawCookie(response, SESSION_COOKIE), COOKIE_SECRET)?.name).toBe('plainname');
    });
});

describe('POST /logout', () => {
    const sessionCookie = async (): Promise<string> => {
        const response = await callback(
            request(`/login/callback?code=abc&state=${STATE}`, { loginState: signed(STATE) }),
        );
        return rawCookie(response, SESSION_COOKIE)!;
    };

    it('clears the session and redirects with a 303', async () => {
        const response = await logout(request('/logout', { [SESSION_COOKIE]: await sessionCookie() }, { method: 'POST' }));

        // 303 so the browser follows with a GET; a 302 after a POST re-POSTs in some clients.
        expect(response.status).toBe(303);
        expect(response.headers.get('location')).toBe('/');
        expect(setCookieLine(response, SESSION_COOKIE)).toContain('Max-Age=0');
    });

    it('revokes the token at Discord rather than only forgetting it', async () => {
        await logout(request('/logout', { [SESSION_COOKIE]: await sessionCookie() }, { method: 'POST' }));
        expect(DiscordLogin.revokeLoginToken).toHaveBeenCalledWith('login-access-token');
    });

    it('refuses a cross-origin submission', async () => {
        const response = await logout(request(
            '/logout',
            { [SESSION_COOKIE]: await sessionCookie() },
            { method: 'POST', headers: { origin: 'https://not-us.example' } },
        ));
        expect(response.status).toBe(403);
        expect(DiscordLogin.revokeLoginToken).not.toHaveBeenCalled();
    });

    it('still clears the cookie when there is no session to revoke', async () => {
        const response = await logout(request('/logout', {}, { method: 'POST' }));
        expect(response.status).toBe(303);
        expect(setCookieLine(response, SESSION_COOKIE)).toContain('Max-Age=0');
        expect(DiscordLogin.revokeLoginToken).not.toHaveBeenCalled();
    });

    it('signs out even if revoking fails', async () => {
        vi.mocked(DiscordLogin.revokeLoginToken).mockRejectedValueOnce(new Error('Discord is down'));
        const response = await logout(request('/logout', { [SESSION_COOKIE]: await sessionCookie() }, { method: 'POST' }));
        expect(response.status).toBe(303);
    });
});
