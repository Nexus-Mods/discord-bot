import { describe, it, expect } from 'vitest';
import {
    FixedWindowCounter, GENERAL, SENSITIVE, isSensitive, rateLimitHeaders,
} from '@/lib/security/rateLimit';

/** A clock the test moves, so nothing here waits a real minute to see a window reset. */
function fakeClock(start = 1_000_000) {
    let now = start;
    return { now: () => now, advance: (ms: number) => { now += ms; } };
}

describe('the limits are the Express ones', () => {
    it('is 120 a minute in general and 10 a minute for the sensitive paths', () => {
        expect(GENERAL).toEqual({ limit: 120, windowMs: 60_000 });
        expect(SENSITIVE).toEqual({ limit: 10, windowMs: 60_000 });
    });

    it('marks exactly the paths Express registers sensitiveLimit on', () => {
        for (const p of ['/linked-role', '/discord-oauth-callback', '/nexus-mods-callback',
            '/update-metadata', '/show-metadata', '/revoke']) {
            expect(isSensitive(p), p).toBe(true);
        }
    });

    it('does not catch /revoked, which is a page anyone might reload', () => {
        // The reason the match is exact rather than a prefix: /revoked is what someone
        // sees *after* unlinking, and putting it in the ten-a-minute bucket would rate
        // limit a refresh.
        expect(isSensitive('/revoked')).toBe(false);
        expect(isSensitive('/')).toBe(false);
        expect(isSensitive('/tracking')).toBe(false);
        expect(isSensitive('/revoke/')).toBe(false);
    });
});

describe('the counter, exercised rather than asserted about', () => {
    it('allows exactly the limit and refuses the next one', () => {
        const clock = fakeClock();
        const counter = new FixedWindowCounter(SENSITIVE, clock.now);

        const allowed = Array.from({ length: 10 }, () => counter.hit('1.2.3.4').ok);
        expect(allowed).toEqual(Array(10).fill(true));

        const eleventh = counter.hit('1.2.3.4');
        expect(eleventh.ok).toBe(false);
        expect(eleventh.remaining).toBe(0);
    });

    it('counts the general limit to 120', () => {
        const clock = fakeClock();
        const counter = new FixedWindowCounter(GENERAL, clock.now);
        for (let i = 0; i < 120; i += 1) expect(counter.hit('1.2.3.4').ok).toBe(true);
        expect(counter.hit('1.2.3.4').ok).toBe(false);
    });

    it('counts each caller separately', () => {
        const clock = fakeClock();
        const counter = new FixedWindowCounter(SENSITIVE, clock.now);
        for (let i = 0; i < 10; i += 1) counter.hit('1.2.3.4');
        expect(counter.hit('1.2.3.4').ok).toBe(false);
        expect(counter.hit('5.6.7.8').ok).toBe(true);
    });

    it('forgives when the window rolls over', () => {
        const clock = fakeClock();
        const counter = new FixedWindowCounter(SENSITIVE, clock.now);
        for (let i = 0; i < 11; i += 1) counter.hit('1.2.3.4');
        expect(counter.hit('1.2.3.4').ok).toBe(false);

        clock.advance(60_000);
        expect(counter.hit('1.2.3.4').ok).toBe(true);
    });

    it('is a fixed window, so nearly twice the limit can land in a second', () => {
        // Not a defect, and the Express version behaves the same way, but not something
        // to discover during an incident either. A window opens on a caller's first hit,
        // so spending the rest of the allowance just before it closes and the whole of
        // the next one just after puts 19 requests inside about a second.
        const clock = fakeClock();
        const counter = new FixedWindowCounter(SENSITIVE, clock.now);

        expect(counter.hit('1.2.3.4').ok).toBe(true);   // opens the window
        clock.advance(59_000);
        for (let i = 0; i < 9; i += 1) expect(counter.hit('1.2.3.4').ok).toBe(true);
        expect(counter.hit('1.2.3.4').ok).toBe(false);  // the allowance is spent

        clock.advance(1_001);                            // the window rolls over
        for (let i = 0; i < 10; i += 1) expect(counter.hit('1.2.3.4').ok).toBe(true);
    });

    it('counts down and reports when the window resets', () => {
        const clock = fakeClock();
        const counter = new FixedWindowCounter(SENSITIVE, clock.now);

        expect(counter.hit('1.2.3.4').remaining).toBe(9);
        expect(counter.hit('1.2.3.4').remaining).toBe(8);

        clock.advance(30_000);
        const mid = counter.hit('1.2.3.4');
        expect(mid.resetSeconds).toBe(30);
        expect(mid.windowSeconds).toBe(60);
    });

    it('never reports a reset of zero while it is refusing', () => {
        // A client that reads Retry-After: 0 retries immediately, which is a loop.
        const clock = fakeClock();
        const counter = new FixedWindowCounter(SENSITIVE, clock.now);
        for (let i = 0; i < 11; i += 1) counter.hit('1.2.3.4');
        clock.advance(59_999);
        const last = counter.hit('1.2.3.4');
        expect(last.ok).toBe(false);
        expect(last.resetSeconds).toBeGreaterThanOrEqual(1);
    });

    it('does not grow without bound', () => {
        // The Map is keyed by client address, so without eviction it is every visitor
        // since the last restart. 2,000 distinct callers, then a window later, one more.
        const clock = fakeClock();
        const counter = new FixedWindowCounter(GENERAL, clock.now);
        for (let i = 0; i < 2000; i += 1) counter.hit(`10.0.${Math.floor(i / 256)}.${i % 256}`);
        expect(counter.size).toBe(2000);

        clock.advance(60_001);
        counter.hit('1.2.3.4');
        expect(counter.size).toBe(1);
    });
});

describe('the draft-7 headers', () => {
    it('are the ones express-rate-limit emits', () => {
        const clock = fakeClock();
        const counter = new FixedWindowCounter(GENERAL, clock.now);
        const headers = rateLimitHeaders(counter.hit('1.2.3.4'));

        expect(headers['RateLimit-Policy']).toBe('120;w=60');
        expect(headers['RateLimit']).toBe('limit=120, remaining=119, reset=60');
    });
});
