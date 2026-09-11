/**
 * A byte cap on a request body.
 *
 * Express got this from `express.json({ limit: '5mb' })` on /webhook - configuration, on a
 * body parser that had already been handed the whole request. A Next route handler is
 * given a stream, so the cap has to be *enforced* rather than declared: read chunks,
 * count, and stop.
 *
 * That difference is the point. `await request.json()` in a route handler will happily
 * buffer whatever arrives, and /webhook is the one endpoint here that takes a large
 * unauthenticated POST - Invision offers no shared secret, no HMAC and no IP setting, so
 * anyone who learns the URL can post to it. A parser with no cap turns that into "anyone
 * who learns the URL can decide how much memory this process uses".
 *
 * The cap is checked against the running total rather than Content-Length, because
 * Content-Length is a claim by the sender and a chunked request does not have one.
 */

export type BodyResult<T> =
    | { ok: true; value: T }
    | { ok: false; status: 400 | 413; reason: 'too-large' | 'unparseable' };

/** Read the body as text, refusing anything over the cap. */
export async function readTextWithLimit(request: Request, maxBytes: number): Promise<BodyResult<string>> {
    const body = request.body;
    if (!body) return { ok: true, value: '' };

    // Cheap rejection first, for the well-behaved sender that declares its size. A liar
    // is caught by the running total below; this just avoids reading 500MB to find out.
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
        return { ok: false, status: 413, reason: 'too-large' };
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            total += value.byteLength;
            if (total > maxBytes) {
                // Stop pulling. Without this the sender can keep writing into a stream
                // nobody is reading, which is the leak the cap exists to prevent.
                await reader.cancel();
                return { ok: false, status: 413, reason: 'too-large' };
            }
            chunks.push(value);
        }
    }
    catch {
        // A truncated or aborted upload. Not a parse failure, but the caller has the same
        // two choices either way and 400 is the honest one.
        return { ok: false, status: 400, reason: 'unparseable' };
    }

    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return { ok: true, value: new TextDecoder().decode(joined) };
}

/** The same, parsed as JSON. Invalid JSON is a 400, not a throw. */
export async function readJsonWithLimit(request: Request, maxBytes: number): Promise<BodyResult<unknown>> {
    const text = await readTextWithLimit(request, maxBytes);
    if (!text.ok) return text;
    if (text.value === '') return { ok: false, status: 400, reason: 'unparseable' };
    try {
        return { ok: true, value: JSON.parse(text.value) };
    }
    catch {
        return { ok: false, status: 400, reason: 'unparseable' };
    }
}

/** The Express value for /webhook, named rather than repeated at the call site. */
export const WEBHOOK_MAX_BYTES = 5 * 1024 * 1024;
