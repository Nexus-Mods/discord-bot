import { describe, it, expect } from 'vitest';
import { WEBHOOK_MAX_BYTES, readJsonWithLimit, readTextWithLimit } from '@/lib/security/bodyLimit';

/** A request whose body is delivered in chunks, like a real one. */
function streamed(body: string, headers: Record<string, string> = {}): Request {
    const bytes = new TextEncoder().encode(body);
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            for (let i = 0; i < bytes.length; i += 64) controller.enqueue(bytes.slice(i, i + 64));
            controller.close();
        },
    });
    return new Request('https://example.test/webhook', {
        method: 'POST',
        body: stream,
        headers,
        // Required by undici when the body is a stream.
        duplex: 'half',
    } as RequestInit & { duplex: 'half' });
}

describe('the cap', () => {
    it('is the Express value', () => {
        expect(WEBHOOK_MAX_BYTES).toBe(5 * 1024 * 1024);
    });

    it('reads a body under it', async () => {
        const result = await readTextWithLimit(streamed('hello'), 1024);
        expect(result).toEqual({ ok: true, value: 'hello' });
    });

    it('refuses one over it', async () => {
        const result = await readTextWithLimit(streamed('x'.repeat(2048)), 1024);
        expect(result).toEqual({ ok: false, status: 413, reason: 'too-large' });
    });

    it('counts bytes, not characters', async () => {
        // 400 emoji is 1,600 bytes and 800 UTF-16 units. A length check would let this
        // through a 1,000-byte cap.
        const result = await readTextWithLimit(streamed('🎮'.repeat(400)), 1000);
        expect(result.ok).toBe(false);
    });

    it('rejects a large declared size without reading the body', async () => {
        const result = await readTextWithLimit(streamed('small', { 'content-length': '99999999' }), 1024);
        expect(result).toEqual({ ok: false, status: 413, reason: 'too-large' });
    });

    it('catches a sender that lies about its size', async () => {
        // THE case. Content-Length is a claim, and a chunked request has none at all, so
        // the running total is what actually enforces this.
        const result = await readTextWithLimit(streamed('x'.repeat(4096), { 'content-length': '10' }), 1024);
        expect(result).toEqual({ ok: false, status: 413, reason: 'too-large' });
    });

    it('allows a body exactly on the boundary', async () => {
        expect((await readTextWithLimit(streamed('x'.repeat(1024)), 1024)).ok).toBe(true);
        expect((await readTextWithLimit(streamed('x'.repeat(1025)), 1024)).ok).toBe(false);
    });
});

describe('reading JSON', () => {
    it('parses what is under the cap', async () => {
        const result = await readJsonWithLimit(streamed(JSON.stringify({ a: 1 })), 1024);
        expect(result).toEqual({ ok: true, value: { a: 1 } });
    });

    it('is a 400 for something that is not JSON, not a throw', async () => {
        expect(await readJsonWithLimit(streamed('{not json'), 1024))
            .toEqual({ ok: false, status: 400, reason: 'unparseable' });
    });

    it('is a 400 for an empty body', async () => {
        expect(await readJsonWithLimit(streamed(''), 1024))
            .toEqual({ ok: false, status: 400, reason: 'unparseable' });
    });

    it('reports too-large before it tries to parse', async () => {
        const huge = JSON.stringify({ pad: 'x'.repeat(4096) });
        expect(await readJsonWithLimit(streamed(huge), 1024))
            .toEqual({ ok: false, status: 413, reason: 'too-large' });
    });
});
