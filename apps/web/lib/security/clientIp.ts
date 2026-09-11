/**
 * The client's address behind a reverse proxy, for rate limiting.
 *
 * Each proxy appends the address it saw, so the client is the Nth entry from the RIGHT
 * where N is the proxy count. Taking the leftmost entry instead trusts whatever the
 * client sent and is bypassable with one header.
 */

/** A bag of optional strings, not NodeJS.ProcessEnv, which Next augments with a required NODE_ENV. */
export type Env = Readonly<Record<string, string | undefined>>;

/** How many proxies stand between the internet and this process. */
export function trustedProxyCount(env: Env = process.env): number {
    const raw = env.TRUST_PROXY;
    if (raw === undefined || raw === '') return 0;
    const n = Number(raw);
    // A present but unusable value means 1, as in Express, so a typo does not turn the
    // header off silently.
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/** The client's address, or undefined when it cannot be established. Never "". */
export function clientIp(headers: Headers, env: Env = process.env): string | undefined {
    const hops = trustedProxyCount(env);

    // No proxy configured, and Next exposes no socket address - so the header is
    // unverifiable and is ignored rather than trusted.
    if (hops === 0) return undefined;

    const forwarded = headers.get('x-forwarded-for');
    if (!forwarded) return undefined;

    const chain = forwarded.split(',').map((a) => a.trim()).filter(Boolean);
    if (chain.length === 0) return undefined;

    // Clamped: a proxy that did not append leaves the chain shorter than the hop count.
    const index = Math.max(0, chain.length - hops);
    return chain[index];
}

/**
 * The key a rate limiter counts against.
 *
 * Unidentifiable clients share one bucket rather than bypassing the limit.
 */
export function rateLimitKey(headers: Headers, env: Env = process.env): string {
    return clientIp(headers, env) ?? 'unidentified';
}
