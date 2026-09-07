import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Two things about this version of Next that were got wrong twice from memory.
 *
 * `export const runtime = 'nodejs'` is the default and the docs say to remove it, because
 * the Edge runtime it exists to opt out of is deprecated. `export const dynamic` is the
 * previous caching model and is absent from Next 16's route segment config table
 * altogether - and on a Route Handler it never said anything, since "Route Handlers are
 * not cached by default".
 *
 * Both were written here out of habit before the bundled docs were read, so this is the
 * habit rather than the framework being pinned.
 */
const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');

function files(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const p = path.join(dir, entry);
        if (statSync(p).isDirectory()) out.push(...files(p));
        else if (/\.tsx?$/.test(p)) out.push(p);
    }
    return out;
}

const rel = (f: string) => path.relative(path.join(APP, '..'), f).replace(/\\/g, '/');

/**
 * Comments stripped before matching.
 *
 * The first version of these checks reported both pages, because both explain in a doc
 * comment which export they no longer use and why. The same trap the
 * npm_package_version check fell into: a rule that reads its own documentation as a
 * violation.
 */
const code = (f: string) => readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

describe('route segment config', () => {
    const sources = files(APP);

    it('found the routes to check', () => {
        // A walk that returns nothing agrees with every rule below.
        expect(sources.length).toBeGreaterThan(10);
    });

    it('exports no runtime, which is the default and deprecated to state', () => {
        expect(sources.filter((f) => /export const runtime\b/.test(code(f))).map(rel)).toEqual([]);
    });

    it('exports no dynamic, which is the previous caching model', () => {
        expect(sources.filter((f) => /export const dynamic\b/.test(code(f))).map(rel)).toEqual([]);
    });

    /**
     * The reason `dynamic` was there in the first place.
     *
     * Two pages produce different output per request without touching a Request-time API
     * the framework can see: the status page reads a clock and process.uptime(), and the
     * timestamp converter defaults to "now". Prerendered, both would report the time of
     * the build - confidently, and forever. `connection()` is what stops that.
     */
    it('has the two per-request pages await connection()', () => {
        // app/page.tsx reads a clock and process.uptime(). app/timestamp/page.tsx defaults
        // its result to "now" - through parseToMs('') rather than a visible Date call,
        // which is why this list is named rather than detected.
        for (const page of ['app/page.tsx', 'app/timestamp/page.tsx']) {
            const body = code(path.join(APP, '..', page));
            expect(body, `${page} must await connection() or it renders the build time`)
                .toContain('await connection()');
        }
    });

    it('catches a third page reading a clock directly', () => {
        const clockPages = sources
            .filter((f) => /process\.uptime\(\)|Date\.now\(\)|new Date\(\s*\)/.test(code(f)))
            .filter((f) => !code(f).includes('await connection()'))
            .map(rel);
        expect(clockPages).toEqual([]);
    });
});
