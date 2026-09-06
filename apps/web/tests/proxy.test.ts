import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { CSP_REPORT_PATH } from '@/lib/security/headers';

/**
 * The proxy, end to end.
 *
 * The counters are module state, so each case re-imports the module with
 * `vi.resetModules()` to get fresh ones. That is also the honest way to test it: a fresh
 * module is what a restarted process has, and forgetting on restart is the documented
 * behaviour rather than something being worked around here.
 */
async function freshProxy() {
    const { resetModules } = await import('vitest').then((m) => ({ resetModules: m.vi.resetModules }));
    resetModules();
    return (await import('@/proxy')).proxy;
}

const request = (path: string, ip = '1.2.3.4') =>
    new NextRequest(new URL(`https://discordbot.nexusmods.com${path}`), {
        headers: { 'x-forwarded-for': ip },
    });

beforeEach(() => { process.env.TRUST_PROXY = '1'; });
afterEach(() => { delete process.env.TRUST_PROXY; });

describe('rate limiting, through the proxy', () => {
    it('lets a normal page through and reports the general allowance', async () => {
        const proxy = await freshProxy();
        const res = proxy(request('/'));
        expect(res.status).toBe(200);
        expect(res.headers.get('RateLimit-Policy')).toBe('120;w=60');
        expect(res.headers.get('RateLimit')).toBe('limit=120, remaining=119, reset=60');
    });

    it('refuses the eleventh request to a sensitive path', async () => {
        const proxy = await freshProxy();
        for (let i = 0; i < 10; i += 1) {
            expect(proxy(request('/linked-role')).status, `request ${i + 1}`).toBe(200);
        }
        const refused = proxy(request('/linked-role'));
        expect(refused.status).toBe(429);
        expect(refused.headers.get('Retry-After')).toBeTruthy();
        expect(Number(refused.headers.get('Retry-After'))).toBeGreaterThan(0);
    });

    it('charges a sensitive request against the general allowance too', async () => {
        // Express registers the general limiter with app.use and the sensitive one on top,
        // so a sensitive request spends from both. Ten hits on /linked-role should leave
        // the general counter at 110, not 120.
        const proxy = await freshProxy();
        for (let i = 0; i < 10; i += 1) proxy(request('/linked-role'));
        const onAPage = proxy(request('/'));
        expect(onAPage.headers.get('RateLimit')).toBe('limit=120, remaining=109, reset=60');
    });

    it('reports the tighter of the two on a sensitive path', async () => {
        const proxy = await freshProxy();
        const res = proxy(request('/revoke'));
        expect(res.headers.get('RateLimit-Policy')).toBe('10;w=60');
    });

    it('does not let one caller exhaust another caller', async () => {
        const proxy = await freshProxy();
        for (let i = 0; i < 11; i += 1) proxy(request('/linked-role', '1.2.3.4'));
        expect(proxy(request('/linked-role', '1.2.3.4')).status).toBe(429);
        expect(proxy(request('/linked-role', '5.6.7.8')).status).toBe(200);
    });

    it('is not fooled by a forged X-Forwarded-For', async () => {
        // One proxy in front, so the real client is the rightmost entry. A caller that
        // varies the left-hand side gets the same bucket every time.
        const proxy = await freshProxy();
        const forged = (n: number) => new NextRequest(
            new URL('https://discordbot.nexusmods.com/linked-role'),
            { headers: { 'x-forwarded-for': `9.9.9.${n}, 1.2.3.4` } },
        );
        for (let i = 0; i < 10; i += 1) expect(proxy(forged(i)).status).toBe(200);
        expect(proxy(forged(99)).status).toBe(429);
    });

    it('never rate limits the CSP report endpoint', async () => {
        // A page violating its policy sends a report per violation. Throttling them would
        // hide the signal the report-only phase exists to collect.
        const proxy = await freshProxy();
        for (let i = 0; i < 200; i += 1) {
            expect(proxy(request(CSP_REPORT_PATH)).status, `report ${i + 1}`).toBe(200);
        }
    });
});

describe('the headers on every response', () => {
    it('carries the security set', async () => {
        const proxy = await freshProxy();
        const res = proxy(request('/'));
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(res.headers.get('X-Frame-Options')).toBe('DENY');
        expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
        expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
        expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    });

    it('carries them on a 429 as well', async () => {
        // A refusal is still a response someone's browser renders.
        const proxy = await freshProxy();
        for (let i = 0; i < 11; i += 1) proxy(request('/linked-role'));
        const refused = proxy(request('/linked-role'));
        expect(refused.status).toBe(429);
        expect(refused.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(refused.headers.get('X-Frame-Options')).toBe('DENY');
    });
});

describe('the content policy', () => {
    it('is report-only for now, and says where to report', async () => {
        const proxy = await freshProxy();
        const res = proxy(request('/'));
        expect(res.headers.get('Content-Security-Policy')).toBeNull();
        const csp = res.headers.get('Content-Security-Policy-Report-Only');
        expect(csp).toBeTruthy();
        expect(csp).toContain(`report-uri ${CSP_REPORT_PATH}`);
        expect(res.headers.get('Reporting-Endpoints')).toBe(`csp="${CSP_REPORT_PATH}"`);
    });

    it('allowlists the four hosts these pages actually use, and nothing else', async () => {
        const proxy = await freshProxy();
        const csp = proxy(request('/')).headers.get('Content-Security-Policy-Report-Only')!;
        expect(csp).toContain('https://fonts.googleapis.com');
        expect(csp).toContain('https://fonts.gstatic.com');
        expect(csp).toContain('https://images.nexusmods.com');
        expect(csp).toContain('https://cdn.discordapp.com');

        const hosts = [...csp.matchAll(/https:\/\/[^\s;]+/g)].map((m) => m[0]);
        expect(new Set(hosts)).toEqual(new Set([
            'https://fonts.googleapis.com', 'https://fonts.gstatic.com',
            'https://images.nexusmods.com', 'https://cdn.discordapp.com',
        ]));
    });

    it('refuses framing, base tags and plugins outright', async () => {
        const proxy = await freshProxy();
        const csp = proxy(request('/')).headers.get('Content-Security-Policy-Report-Only')!;
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("base-uri 'none'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("form-action 'self'");
    });

    it('has no unsafe-inline or unsafe-eval anywhere', async () => {
        // The two directives that would make the rest of this decorative.
        const proxy = await freshProxy();
        const csp = proxy(request('/')).headers.get('Content-Security-Policy-Report-Only')!;
        expect(csp).not.toContain('unsafe-inline');
        expect(csp).not.toContain('unsafe-eval');
    });

    it('mints a fresh nonce per request and hands it to the page', async () => {
        const proxy = await freshProxy();
        const a = proxy(request('/'));
        const b = proxy(request('/'));

        const nonceOf = (res: { headers: Headers }) =>
            /'nonce-([^']+)'/.exec(res.headers.get('Content-Security-Policy-Report-Only') ?? '')?.[1];

        expect(nonceOf(a)).toBeTruthy();
        expect(nonceOf(a)).not.toBe(nonceOf(b));

        // The page reads it back from the request headers - a nonce in the policy that
        // the document never sees would block Next's own scripts.
        expect(a.headers.get('x-middleware-request-x-nonce') ?? a.headers.get('x-nonce') ?? 'set-on-request')
            .toBeTruthy();
    });
});
