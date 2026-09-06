/**
 * Who is asking, when there is a reverse proxy in the way.
 *
 * Rate limiting is worthless without this: behind a proxy every request appears to come
 * from the proxy, so one bucket holds everyone and the first busy visitor locks out the
 * rest. Express got this from `app.set('trust proxy', N)`; Next has no equivalent, and
 * `NextRequest.ip` was removed in 15, so the hop count has to be honoured by hand.
 *
 * The rule, and why it is a count rather than a "take the first entry":
 *
 * Each proxy appends the address *it* saw. With two proxies in front of us a genuine
 * request arrives as `client, proxy1` - two entries, one per hop. A client that sends its
 * own `X-Forwarded-For: spoofed` makes it `spoofed, client, proxy1` - three entries. So
 * the real client is always the Nth from the right, where N is the number of proxies:
 * counting from the left trusts whatever the client wrote, and taking the leftmost entry
 * is the classic way to build a rate limiter anyone can bypass with one header.
 */

/**
 * The shape these read from.
 *
 * Not `NodeJS.ProcessEnv`: Next augments it with a required NODE_ENV, so a test that
 * wants to pass `{ TRUST_PROXY: '1' }` has to invent a NODE_ENV it does not care about.
 * All these functions need is a bag of optional strings.
 */
export type Env = Readonly<Record<string, string | undefined>>;

/** How many proxies stand between the internet and this process. */
export function trustedProxyCount(env: Env = process.env): number {
    const raw = env.TRUST_PROXY;
    if (raw === undefined || raw === '') return 0;
    const n = Number(raw);
    // Express treats a non-numeric or zero TRUST_PROXY as `1` when the variable is
    // present at all, on the grounds that setting it means there is a proxy. Same here,
    // so a typo does not silently turn the header off.
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/**
 * The client's address, or undefined when it cannot be established.
 *
 * Undefined is deliberately distinguishable from a string: the caller decides whether an
 * unidentifiable client shares one bucket with every other unidentifiable client (which
 * is what Express does today) or is let through. It should never silently become "".
 */
export function clientIp(headers: Headers, env: Env = process.env): string | undefined {
    const hops = trustedProxyCount(env);

    // No proxy configured. There is no socket address to fall back on - Next does not
    // expose one - so anything in the header is unverifiable and is ignored rather than
    // trusted. In practice this is local development, where one bucket is correct.
    if (hops === 0) return undefined;

    const forwarded = headers.get('x-forwarded-for');
    if (!forwarded) return undefined;

    const chain = forwarded.split(',').map((a) => a.trim()).filter(Boolean);
    if (chain.length === 0) return undefined;

    // Nth from the right. Clamped, because a proxy that did not append (or a request that
    // arrived from inside the network) leaves the chain shorter than the hop count, and
    // the leftmost entry is the closest thing to a client that exists.
    const index = Math.max(0, chain.length - hops);
    return chain[index];
}

/**
 * The key a rate limiter counts against.
 *
 * `unidentified` is a real, shared bucket rather than a bypass. Express behaves the same
 * way when it is misconfigured behind a proxy - `req.ip` becomes the proxy's address for
 * everyone - and of the two failure modes, throttling everyone together is the one you
 * notice. Letting everyone through is the one you do not.
 */
export function rateLimitKey(headers: Headers, env: Env = process.env): string {
    return clientIp(headers, env) ?? 'unidentified';
}
