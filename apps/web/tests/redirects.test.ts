import { describe, it, expect } from 'vitest';
import { GET as nxm } from '@/app/nxm/route';
import { GET as localhost } from '@/app/localhost-redirect/route';

/**
 * The two endpoints that exist only to turn a query string into a Location header.
 *
 * Both are unauthenticated by design and both build a URL out of user input, which is the
 * shape a redirect bug takes - so the encoding is tested as well as the happy path.
 */
const req = (path: string) => new Request(`https://discordbot.nexusmods.test${path}`);
const location = async (path: string) => (await nxm(req(path))).headers.get('location');

describe('GET /nxm', () => {
    it('builds a collection link, defaulting the revision to latest', async () => {
        expect(await location('/nxm?type=collection&domain=skyrimspecialedition&slug=ndmwtb'))
            .toBe('nxm://skyrimspecialedition/collections/ndmwtb/revisions/latest');
        expect(await location('/nxm?type=collection&domain=skyrimspecialedition&slug=ndmwtb&rev=7'))
            .toBe('nxm://skyrimspecialedition/collections/ndmwtb/revisions/7');
    });

    it('builds a mod file link', async () => {
        expect(await location('/nxm?type=mod&domain=skyrimspecialedition&mod_id=3863&file_id=132146'))
            .toBe('nxm://skyrimspecialedition/mods/3863/files/132146');
    });

    it('leaves real values untouched', async () => {
        // Game domains, slugs and ids are unchanged by percent-encoding, which is what
        // makes encoding them safe to add to an endpoint that has been live for years.
        expect(await location('/nxm?type=collection&domain=baldursgate3&slug=abc-123_x'))
            .toBe('nxm://baldursgate3/collections/abc-123_x/revisions/latest');
    });

    /**
     * A slash in `domain` rewrote the rest of the path in Express's version, because the
     * URL was built by concatenation. It cannot here.
     */
    it('cannot be made to rewrite the path it builds', async () => {
        const built = await location('/nxm?type=mod&domain=x/mods/1/files/2%3F&mod_id=3&file_id=4');
        expect(built).toBe('nxm://x%2Fmods%2F1%2Ffiles%2F2%3F/mods/3/files/4');
        // Still four path segments after the host, whatever the domain claimed to be.
        expect(new URL(built!).pathname.split('/').filter(Boolean)).toHaveLength(4);
    });

    it('says what is missing, with a status', async () => {
        for (const [path, message] of [
            ['/nxm?type=collection&domain=skyrim', 'Domain or slug not provided'],
            ['/nxm?type=collection&slug=ndmwtb', 'Domain or slug not provided'],
            ['/nxm?type=mod&domain=skyrim&mod_id=1', 'Game, mod or file ID not provided'],
            ['/nxm?type=mod&domain=skyrim&file_id=1', 'Game, mod or file ID not provided'],
        ] as const) {
            const response = await nxm(req(path));
            expect(response.status, path).toBe(400);
            expect(await response.text(), path).toBe(message);
        }
    });

    /**
     * Express reached this case having sent nothing at all, so the request hung until the
     * client timed out. It answers now.
     */
    it('answers an unrecognised or absent type instead of hanging', async () => {
        for (const path of ['/nxm', '/nxm?type=', '/nxm?type=something-else']) {
            const response = await nxm(req(path));
            expect(response.status, path).toBe(400);
            expect(await response.text(), path).toContain('Unrecognised link type');
        }
    });
});

describe('GET /localhost-redirect', () => {
    const to = async (path: string) => (await localhost(req(path))).headers.get('location');

    it('sends the browser to the port and token it was given', async () => {
        expect(await to('/localhost-redirect?port=7734&token=abc123')).toBe('http://127.0.0.1:7734?token=abc123');
    });

    it('falls back to 8080 and a placeholder token', async () => {
        expect(await to('/localhost-redirect')).toBe('http://127.0.0.1:8080?token=TestToken');
    });

    it('refuses a port that is not a number', async () => {
        const response = await localhost(req('/localhost-redirect?port=notaport'));
        expect(response.status).toBe(400);
        expect(await response.text()).toBe('Port not specified or invalid');
    });

    /**
     * `?token=a&admin=1` used to arrive at the local application as two parameters, because
     * the token was interpolated raw. Encoded now, so a token is only ever a token.
     */
    it('cannot smuggle extra query parameters through the token', async () => {
        const built = await to('/localhost-redirect?port=7734&token=abc%26admin%3D1');
        expect(built).toBe('http://127.0.0.1:7734?token=abc%26admin%3D1');
        expect([...new URL(built!).searchParams.keys()]).toEqual(['token']);
        expect(new URL(built!).searchParams.get('token')).toBe('abc&admin=1');
    });
});
