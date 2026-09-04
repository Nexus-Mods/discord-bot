import { describe, it, expect } from 'vitest';
import { assertPresent } from '../../src/lib/assert.js';

/**
 * The generated GraphQL types are faithful to the schema, and the schema is a superset
 * of what the API can return. Where a domain rule guarantees a nullable field is
 * present, this says so in one place rather than each caller inventing a fallback for a
 * state that cannot occur.
 */
describe('assertPresent', () => {
    it('returns the value when it is there', () => {
        expect(assertPresent({ a: 1 }, 'why')).toEqual({ a: 1 });
        expect(assertPresent('', 'empty string is a value')).toBe('');
        expect(assertPresent(0, 'zero is a value')).toBe(0);
        expect(assertPresent(false, 'false is a value')).toBe(false);
    });

    it('throws on null and undefined', () => {
        expect(() => assertPresent(null, 'why')).toThrow(/why/);
        expect(() => assertPresent(undefined, 'why')).toThrow(/why/);
    });

    // The whole point: a broken invariant should be attributable, not a TypeError
    // several frames deep inside an embed builder.
    it('names the invariant and carries a user-safe message', () => {
        try {
            assertPresent(null, 'a published collection always has a published revision');
            throw new Error('expected a throw');
        }
        catch (err) {
            expect(err).toMatchObject({
                name: 'NexusApiError',
                code: 'NEXUS_API',
                context: { invariant: 'a published collection always has a published revision' },
            });
            expect((err as Error).message).toContain('published revision');
            expect((err as { userMessage: string }).userMessage).not.toContain('published revision');
        }
    });
});

/**
 * The collection search embed was stamped 1 January 1970 for every collection.
 *
 * `res.updatedAt` was read on the collection, but the query only selects `updatedAt`
 * inside `latestPublishedRevision` - so it was always undefined. `parseInt(undefined)`
 * is NaN, `NaN || 0` is 0, and `new Date(0)` is the Unix epoch. Codegen found it by
 * refusing to admit a field the operation never asked for.
 */
describe('collection embed timestamp', () => {
    const oldWay = (res: Record<string, unknown>) => new Date(parseInt(res.updatedAt as string) || 0);
    const newWay = (revision: { updatedAt: string }) => new Date(revision.updatedAt);

    it('the old expression produced the epoch', () => {
        expect(oldWay({}).toISOString()).toBe('1970-01-01T00:00:00.000Z');
    });

    it('parseInt was wrong for a date string even with the right field', () => {
        // '2026-08-20T...' parses as the number 2026, i.e. 2.026 seconds after the epoch.
        expect(oldWay({ updatedAt: '2026-08-20T10:15:00Z' }).getUTCFullYear()).toBe(1970);
    });

    it('reads the revision timestamp instead', () => {
        expect(newWay({ updatedAt: '2026-08-20T10:15:00Z' }).toISOString()).toBe('2026-08-20T10:15:00.000Z');
    });
});
