import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The guard on POST /webhook - S3, the last exploitable finding from the original audit.
 *
 * Worth stating what it was, because the guard looks like ceremony otherwise. The endpoint
 * rendered its POST body into a Discord channel, and the payload controls the whole embed:
 * the clickable title link, the author's display name, the author's avatar image and two
 * thousand characters of text. So anyone who knew the URL could put a message that reads
 * as a genuine Nexus Mods suggestion, carrying any link they chose, in front of that
 * channel. The `forum.id === 9063` filter is not a defence - it reads the id out of the
 * same body.
 *
 * The secret is in the query string because Invision attaches no headers of its own and
 * this installation cannot be made to, so the target URL is the only configurable part of
 * the request.
 */
const handleForumEvent = vi.fn();
const readJsonWithLimit = vi.fn();

vi.mock('@nexusmods/core/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/forum/webhook', () => ({ handleForumEvent: (d: unknown, l: unknown) => handleForumEvent(d, l) }));
vi.mock('@/lib/security/bodyLimit', () => ({
    WEBHOOK_MAX_BYTES: 5 * 1024 * 1024,
    readJsonWithLimit: (r: unknown, n: number) => readJsonWithLimit(r, n),
}));

const { POST } = await import('@/app/webhook/route');

const SECRET = 'a-long-random-value';

/** A payload that would render an embed with an attacker's link in it. */
const HOSTILE = {
    title: 'Free Nexus Premium',
    forum: { id: 9063 },
    tags: [],
    url: 'https://not-nexusmods.example/claim',
    firstPost: {
        author: { name: 'Nexus Mods Staff', photoUrl: 'https://tracker.example/pixel.png' },
        content: '<p>Click here to claim</p>',
        date: '2026-01-01T00:00:00Z',
    },
};

const post = (query: string) => new Request(`https://discordbot.nexusmods.test/webhook${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(HOSTILE),
});

beforeEach(() => {
    vi.clearAllMocks();
    // The route does `handleForumEvent(...).catch(...)`, so the double has to be a promise.
    handleForumEvent.mockResolvedValue(undefined);
    readJsonWithLimit.mockResolvedValue({ ok: true, value: HOSTILE });
    process.env.FORUM_WEBHOOK_SECRET = SECRET;
});
afterEach(() => { delete process.env.FORUM_WEBHOOK_SECRET; });

describe('POST /webhook', () => {
    it('accepts a request carrying the secret', async () => {
        const response = await POST(post(`?key=${SECRET}`));
        expect(response.status).toBe(200);
        expect(handleForumEvent).toHaveBeenCalledOnce();
    });

    it('refuses the bare URL, which is what the finding was', async () => {
        const response = await POST(post(''));
        expect(response.status).toBe(401);
        expect(await response.text()).toBe('');
        // Nothing reached the renderer, so nothing reached Discord.
        expect(handleForumEvent).not.toHaveBeenCalled();
    });

    it('refuses a wrong or empty secret', async () => {
        for (const query of ['?key=', '?key=wrong', '?key=a-long-random-valu', '?key=a-long-random-values']) {
            const response = await POST(post(query));
            expect(response.status, query).toBe(401);
        }
        expect(handleForumEvent).not.toHaveBeenCalled();
    });

    it('FAILS CLOSED when the secret is not configured', async () => {
        // The deliberate trade: an unconfigured deployment refuses forum traffic rather
        // than accepting anyone's. The boot check warns about it by name.
        delete process.env.FORUM_WEBHOOK_SECRET;
        expect((await POST(post(`?key=${SECRET}`))).status).toBe(401);
        expect((await POST(post(''))).status).toBe(401);
        expect(handleForumEvent).not.toHaveBeenCalled();
    });

    /**
     * The refusal comes before the body is read. Otherwise an unauthenticated caller can
     * still make this process buffer five megabytes on its way to being told no.
     *
     * Asserted on the reader rather than on the stream: constructing a Request with a
     * ReadableStream body pulls it immediately, so "was the stream read" answers a question
     * about undici, not about this route.
     */
    it('refuses before reading the body', async () => {
        expect((await POST(post(''))).status).toBe(401);
        expect(readJsonWithLimit, 'the body was read before the request was refused').not.toHaveBeenCalled();

        // And on the way through, it is read - so the assertion above means ordering
        // rather than the reader never being called at all.
        await POST(post(`?key=${SECRET}`));
        expect(readJsonWithLimit).toHaveBeenCalledOnce();
    });
});
