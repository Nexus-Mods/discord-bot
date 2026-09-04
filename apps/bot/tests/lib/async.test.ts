import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../../src/lib/async.js';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('mapWithConcurrency', () => {
    it('runs every item and keeps results in order', async () => {
        const items = [1, 2, 3, 4, 5];
        const results = await mapWithConcurrency(items, 2, async (n) => {
            await tick();
            return n * 10;
        });
        expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([10, 20, 30, 40, 50]);
    });

    it('never exceeds the limit', async () => {
        // The bug this replaces: list.map(async ...) starts everything at once, so
        // capping at the Promise.all afterwards caps nothing.
        let inFlight = 0;
        let peak = 0;
        await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await tick();
            inFlight--;
        });
        expect(peak).toBe(3);
    });

    it('keeps going after a failure and reports it', async () => {
        const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
            if (n === 2) throw new Error('boom');
            return n;
        });
        expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
        expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    });

    it('does not reject even when every item fails', async () => {
        await expect(mapWithConcurrency([1, 2], 2, async () => { throw new Error('x'); })).resolves.toHaveLength(2);
    });

    it('handles an empty list', async () => {
        await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
    });

    it('handles a limit larger than the list', async () => {
        const results = await mapWithConcurrency([1, 2], 99, async (n) => n);
        expect(results).toHaveLength(2);
    });

    it('rejects a nonsensical limit', async () => {
        await expect(mapWithConcurrency([1], 0, async (n) => n)).rejects.toThrow(RangeError);
    });
});
