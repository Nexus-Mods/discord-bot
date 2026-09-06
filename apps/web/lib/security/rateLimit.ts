/**
 * The two limits Express carries, rebuilt.
 *
 * `express-rate-limit` has no Next equivalent and, on a single droplet, no platform layer
 * underneath to fall back on. This is a fixed window per key held in a Map, which is what
 * express-rate-limit's default MemoryStore is - so the behaviour is the same one that has
 * been running, including the parts worth stating out loud rather than inheriting:
 *
 *   - It is per process. The web service is `scale: 1` in compose and one container in
 *     production, so today that is the whole system. A second replica silently doubles
 *     every limit.
 *   - It resets on restart, so a deploy forgives everyone mid-window.
 *   - It is a fixed window, not a sliding one: a caller can spend the rest of one
 *     window's allowance and the whole of the next back to back, so the real worst case
 *     is close to twice the limit in a second. True of the Express version too.
 *
 * One difference from express-rate-limit's MemoryStore, in this version's favour: that
 * store resets every key together on a single interval timer, so a caller who arrives
 * just after a reset gets a full allowance no matter what they spent a moment earlier.
 * Here each key's window opens on its own first hit. Same limits, no shared boundary to
 * synchronise against.
 *
 * None of that is a reason not to have it. It stops a script, not a botnet.
 */

export interface Limit {
    /** Requests allowed per window. */
    limit: number;
    /** Window length in milliseconds. */
    windowMs: number;
}

export interface Decision {
    ok: boolean;
    limit: number;
    remaining: number;
    /** Seconds until the window resets. Never negative, never zero while limited. */
    resetSeconds: number;
    windowSeconds: number;
}

/** The Express values, unchanged: generous for browsing, tight for anything that starts a flow. */
export const GENERAL: Limit = { limit: 120, windowMs: 60_000 };
export const SENSITIVE: Limit = { limit: 10, windowMs: 60_000 };

/**
 * The paths Express registers `sensitiveLimit` on.
 *
 * Matched by exact path rather than prefix. A prefix match would put /revoked - the page
 * shown *after* an unlink, which anyone might reload - in the same ten-per-minute bucket
 * as /revoke, the endpoint that performs one.
 */
export const SENSITIVE_PATHS: ReadonlySet<string> = new Set([
    '/linked-role',
    '/discord-oauth-callback',
    '/nexus-mods-callback',
    '/update-metadata',
    '/show-metadata',
    '/revoke',
]);

export function isSensitive(pathname: string): boolean {
    return SENSITIVE_PATHS.has(pathname);
}

interface Window { count: number; resetAt: number }

/**
 * One counter. Separate instances for the general and sensitive limits, so a request to a
 * sensitive path is counted against both - which is what Express does, since the general
 * limiter is `app.use`d before the routes and the sensitive one is per-route on top.
 */
export class FixedWindowCounter {
    private readonly windows = new Map<string, Window>();

    constructor(private readonly config: Limit, private readonly now: () => number = Date.now) {}

    hit(key: string): Decision {
        const t = this.now();
        this.evict(t);

        let window = this.windows.get(key);
        if (!window || window.resetAt <= t) {
            window = { count: 0, resetAt: t + this.config.windowMs };
            this.windows.set(key, window);
        }
        window.count += 1;

        const remaining = Math.max(0, this.config.limit - window.count);
        return {
            ok: window.count <= this.config.limit,
            limit: this.config.limit,
            remaining,
            resetSeconds: Math.max(1, Math.ceil((window.resetAt - t) / 1000)),
            windowSeconds: Math.ceil(this.config.windowMs / 1000),
        };
    }

    /**
     * Drop windows that have expired.
     *
     * Without this the Map is an unbounded cache keyed by client address - every IP that
     * ever visits, kept until restart. Expired entries are cheap to find because they all
     * carry their own reset time, so this walks rather than schedules: no timer to leak,
     * and nothing to clean up in a test.
     */
    private evict(t: number): void {
        if (this.windows.size < 1000) return;
        for (const [key, window] of this.windows) {
            if (window.resetAt <= t) this.windows.delete(key);
        }
    }

    /** Test seam. Production never needs it: the process restarting is the reset. */
    reset(): void {
        this.windows.clear();
    }

    get size(): number {
        return this.windows.size;
    }
}

/**
 * The draft-7 headers express-rate-limit emits with `standardHeaders: 'draft-7'`.
 *
 * Kept identical so anything already reading them - a monitor, a client backing off -
 * does not have to learn a second dialect at the cutover.
 */
export function rateLimitHeaders(decision: Decision): Record<string, string> {
    return {
        'RateLimit-Policy': `${decision.limit};w=${decision.windowSeconds}`,
        'RateLimit': `limit=${decision.limit}, remaining=${decision.remaining}, reset=${decision.resetSeconds}`,
    };
}
