/**
 * The two limits Express carries, rebuilt: a fixed window per key in a Map, which is what
 * express-rate-limit's MemoryStore is. Worth knowing:
 *
 *   - per process, so a second replica silently doubles every limit
 *   - resets on restart, so a deploy forgives everyone mid-window
 *   - fixed, not sliding: the worst case is close to twice the limit in a second
 *
 * Unlike MemoryStore, each key's window opens on its own first hit rather than on a shared
 * timer. It stops a script, not a botnet.
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

/** Exact paths, not prefixes: /revoked is reloadable and must not share /revoke's bucket. */
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

/** One counter; the general and sensitive limits are separate instances. */
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

    /** Without this the Map grows unbounded. Walks rather than schedules, so no timer leaks. */
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
