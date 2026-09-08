import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LINK_STATE_COOKIE, openLinkState, sealLinkState } from '@nexusmods/auth/linkState.js';
import { signCookieValue, unsignCookieValue } from '@/lib/security/signedCookies';

/**
 * The three requests an account link is made of, driven through the route handlers.
 *
 * The Express version of this file is apps/bot/tests/server/link-flow.test.ts and it works
 * by starting the app and driving it with a cookie jar. These call the exported GET with a
 * hand-built Request instead, which is why the handlers take `Request` rather than
 * `NextRequest`: there is no server, no port and no framework in the loop, so a failure
 * here is the handler's.
 *
 * What is under test is the refusals. The happy path is three redirects and is worth one
 * test each; the interesting cases are the eight ways a request can fail to prove it
 * belongs to the flow it claims, because every one of them is somebody else's link
 * otherwise.
 */

const COOKIE_SECRET = 'test-cookie-secret';
const STATE = '11111111-2222-3333-4444-555555555555';

const discordTokens = {
    access_token: 'discord-access', refresh_token: 'discord-refresh', expires_at: Date.now() + 600_000,
};

vi.mock('@nexusmods/core/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@nexusmods/auth/DiscordOAuth.js', () => ({
    getOAuthUrl: vi.fn(() => ({ url: `https://discord.com/api/oauth2/authorize?state=${STATE}`, state: STATE })),
    getOAuthTokens: vi.fn(async () => discordTokens),
    getUserData: vi.fn(async () => ({ user: { id: '1234567890', username: 'someone', discriminator: '0' } })),
}));

vi.mock('@nexusmods/auth/NexusModsOAuth.js', () => ({
    getOAuthUrl: vi.fn((state: string) => ({ url: `https://users.nexusmods.com/oauth/authorize?state=${state}`, state })),
}));

vi.mock('@/lib/link/account', () => ({
    completeLink: vi.fn(async () => ({ nexus: 'Pickysaurus', n_id: '31179975', discord: 'someone#0', d_id: '1234567890' })),
}));

const { GET: linkedRole } = await import('@/app/linked-role/route');
const { GET: discordCallback } = await import('@/app/discord-oauth-callback/route');
const { GET: nexusCallback } = await import('@/app/nexus-mods-callback/route');
const DiscordOAuth = await import('@nexusmods/auth/DiscordOAuth.js');
const { completeLink } = await import('@/lib/link/account');

/** A request carrying whatever cookies the test wants, signed or not. */
function request(path: string, cookies: Record<string, string> = {}): Request {
    const header = Object.entries(cookies)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; ');
    return new Request(`https://discordbot.nexusmods.test${path}`, header ? { headers: { cookie: header } } : {});
}

const signed = (value: string) => signCookieValue(value, COOKIE_SECRET);

/** The value a Set-Cookie on the response carries, verified against the secret. */
function cookieOn(response: Response, name: string): string | undefined {
    for (const raw of response.headers.getSetCookie()) {
        const [pair] = raw.split(';');
        const eq = pair.indexOf('=');
        if (pair.slice(0, eq).trim() !== name) continue;
        return unsignCookieValue(decodeURIComponent(pair.slice(eq + 1)), COOKIE_SECRET);
    }
    return undefined;
}

/** The raw Set-Cookie line, for the attributes rather than the value. */
function setCookieLine(response: Response, name: string): string | undefined {
    return response.headers.getSetCookie().find((raw) => raw.startsWith(`${name}=`));
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.COOKIE_SECRET = COOKIE_SECRET;
});

describe('GET /linked-role', () => {
    it('sends the user to Discord and remembers the state in a signed cookie', async () => {
        const response = await linkedRole();

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toContain('https://discord.com/api/oauth2/authorize');
        // The state Discord is asked to echo is the one in the cookie. If these two ever
        // come from different places the callback rejects every genuine return.
        expect(new URL(response.headers.get('location')!).searchParams.get('state')).toBe(STATE);
        expect(cookieOn(response, 'clientState')).toBe(STATE);
    });

    it('signs the cookie rather than storing the state in the clear', async () => {
        const line = setCookieLine(await linkedRole(), 'clientState')!;
        // The signed form is `s:<value>.<mac>`, so the bare state must not be the value.
        expect(decodeURIComponent(line.split(';')[0])).not.toBe(`clientState=${STATE}`);
        expect(line).toContain('s%3A');
    });

    it('keeps the cookie out of scripts and off other sites', async () => {
        const line = setCookieLine(await linkedRole(), 'clientState')!;
        expect(line).toContain('HttpOnly');
        expect(line).toContain('SameSite=lax');
        expect(line).toContain('Path=/');
        // Five minutes, in seconds: Express's cookieOptions(1000 * 60 * 5).
        expect(line).toContain('Max-Age=300');
    });
});

describe('GET /discord-oauth-callback', () => {
    const ok = { code: 'discord-code', state: STATE };
    const url = (params: Record<string, string>) => `/discord-oauth-callback?${new URLSearchParams(params)}`;

    it('forwards to Nexus Mods and seals the Discord tokens into a cookie', async () => {
        const response = await discordCallback(request(url(ok), { clientState: signed(STATE) }));

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toContain('https://users.nexusmods.com/oauth/authorize');

        const sealed = cookieOn(response, LINK_STATE_COOKIE);
        expect(sealed).toBeTruthy();
        const opened = openLinkState(sealed, COOKIE_SECRET, STATE);
        expect(opened?.id).toBe('1234567890');
        expect(opened?.name).toBe('someone#0');
        expect(opened?.tokens.access_token).toBe('discord-access');
    });

    it('seals the tokens to this attempt only', async () => {
        const response = await discordCallback(request(url(ok), { clientState: signed(STATE) }));
        const sealed = cookieOn(response, LINK_STATE_COOKIE);

        // The same cookie, offered as part of a different flow, does not open. This is the
        // check that stops a captured cookie finishing somebody else's link.
        expect(openLinkState(sealed, COOKIE_SECRET, 'a-different-state')).toBeNull();
    });

    it('refuses a request whose state does not match the cookie', async () => {
        const response = await discordCallback(
            request(url({ ...ok, state: 'not-the-state' }), { clientState: signed(STATE) }),
        );
        expect(response.status).toBe(403);
        expect(await response.text()).toBe('');
        // Nothing was spent on it: no token exchange for a request that did not prove itself.
        expect(DiscordOAuth.getOAuthTokens).not.toHaveBeenCalled();
    });

    it('refuses a request with no state cookie at all', async () => {
        expect((await discordCallback(request(url(ok)))).status).toBe(403);
    });

    /**
     * The one that matters most, and the one a hand-rolled cookie read would get wrong.
     *
     * A client can set any cookie it likes. What it cannot do is produce the HMAC, so an
     * unsigned `clientState=<state>` must not be accepted even though its value matches the
     * state in the query - which is exactly what `request.cookies.get('clientState')` would
     * hand you, and it type-checks.
     */
    it('refuses a state cookie that is not signed, even when the value matches', async () => {
        const response = await discordCallback(request(url(ok), { clientState: STATE }));
        expect(response.status).toBe(403);
        expect(DiscordOAuth.getOAuthTokens).not.toHaveBeenCalled();
    });

    it('refuses a state cookie signed with a different secret', async () => {
        const elsewhere = signCookieValue(STATE, 'some-other-deployment');
        expect((await discordCallback(request(url(ok), { clientState: elsewhere }))).status).toBe(403);
    });

    it('sends a missing authorization code to the error page, in a cookie not a query string', async () => {
        const response = await discordCallback(request('/discord-oauth-callback?state=' + STATE, { clientState: signed(STATE) }));

        expect(response.status).toBe(302);
        // The path only - no message in the URL, which anyone could have written.
        expect(response.headers.get('location')).toBe('/oauth-error');
        expect(cookieOn(response, 'ErrorDetail')).toContain('Discord did not return an authorization code');
    });

    it('sends a failed token exchange to the error page', async () => {
        vi.mocked(DiscordOAuth.getOAuthTokens).mockRejectedValueOnce(new Error('[400] Bad Request'));
        const response = await discordCallback(request(url(ok), { clientState: signed(STATE) }));

        expect(response.headers.get('location')).toBe('/oauth-error');
        expect(cookieOn(response, 'ErrorDetail')).toBe('Discord OAuth Error: [400] Bad Request');
    });
});

describe('GET /nexus-mods-callback', () => {
    const url = (params: Record<string, string>) => `/nexus-mods-callback?${new URLSearchParams(params)}`;
    const ok = { code: 'nexus-code', state: STATE };

    /** A browser arriving with both halves of a genuine flow. */
    function cookies(overrides: Record<string, string> = {}): Record<string, string> {
        const sealed = sealFor(STATE);
        return { clientState: signed(STATE), [LINK_STATE_COOKIE]: signed(sealed), ...overrides };
    }

    /**
     * Sealed with the real implementation, imported at the top of the file.
     *
     * Not `require('@nexusmods/auth/linkState.js')`, which was the first version of this:
     * a runtime require goes through node's resolver rather than vitest's aliases, so it
     * answers the package's exports map with dist/ and fails unless someone has run a
     * build. The aliases exist precisely so the suite tests source.
     */
    function sealFor(state: string): string {
        return sealLinkState({ state, id: '1234567890', name: 'someone#0', tokens: discordTokens }, COOKIE_SECRET);
    }

    it('writes the link and sends the user to the success page', async () => {
        const response = await nexusCallback(request(url(ok), cookies()));

        expect(completeLink).toHaveBeenCalledOnce();
        expect(response.status).toBe(302);

        const location = response.headers.get('location')!;
        expect(location.startsWith('/success?')).toBe(true);
        const params = new URLSearchParams(location.slice('/success?'.length));
        // The names the success page reads. Getting these wrong loses the profile links
        // without breaking the page - see tests/routeParity.test.ts.
        expect(params.get('d_id')).toBe('1234567890');
        expect(params.get('n_id')).toBe('31179975');
        expect(params.get('discord')).toBe('someone#0');
        expect(params.get('nexus')).toBe('Pickysaurus');
    });

    it('clears the sealed cookie on the way out, every time', async () => {
        // Live Discord access and refresh tokens are in that cookie. A path that leaves it
        // behind leaves them in the browser for the rest of their five minutes.
        for (const [name, req] of [
            ['success', request(url(ok), cookies())],
            ['state mismatch', request(url({ ...ok, state: 'wrong' }), cookies())],
            ['forged seal', request(url(ok), cookies({ [LINK_STATE_COOKIE]: signed('v1.AAAA.BBBB.CCCC') }))],
            ['no seal', request(url(ok), { clientState: signed(STATE) })],
        ] as const) {
            const line = setCookieLine(await nexusCallback(req), LINK_STATE_COOKIE);
            expect(line, name).toBeTruthy();
            expect(line, name).toContain('Max-Age=0');
        }
    });

    it('refuses a sealed cookie captured from a different attempt', async () => {
        // The victim's cookie is valid, correctly signed, and unexpired. It belongs to
        // another flow, and the state inside it says so.
        const stolen = signed(sealFor('the-victims-state'));
        const response = await nexusCallback(request(url(ok), cookies({ [LINK_STATE_COOKIE]: stolen })));

        expect(response.status).toBe(403);
        expect(completeLink).not.toHaveBeenCalled();
    });

    it('refuses a forged seal', async () => {
        const response = await nexusCallback(
            request(url(ok), cookies({ [LINK_STATE_COOKIE]: signed('v1.AAAA.BBBB.CCCC') })),
        );
        expect(response.status).toBe(403);
        expect(completeLink).not.toHaveBeenCalled();
    });

    it('refuses an unsigned seal, even one holding a genuine payload', async () => {
        const response = await nexusCallback(request(url(ok), cookies({ [LINK_STATE_COOKIE]: sealFor(STATE) })));
        expect(response.status).toBe(403);
        expect(completeLink).not.toHaveBeenCalled();
    });

    it('refuses a state that does not match, before opening anything', async () => {
        const response = await nexusCallback(request(url({ ...ok, state: 'wrong' }), cookies()));
        expect(response.status).toBe(403);
        expect(completeLink).not.toHaveBeenCalled();
    });

    it('sends a failed link to the error page with the reason in a signed cookie', async () => {
        vi.mocked(completeLink).mockRejectedValueOnce(new Error('No Token in new user data!'));
        const response = await nexusCallback(request(url(ok), cookies()));

        expect(response.headers.get('location')).toBe('/oauth-error');
        expect(cookieOn(response, 'ErrorDetail')).toBe('Nexus Mods OAuth Error: No Token in new user data!');
    });
});
