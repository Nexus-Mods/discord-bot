import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { BOT_VERSION } from '../src/version.js';

/**
 * The version must not depend on how the process was started.
 *
 * Everything used to read `process.env.npm_package_version`, which npm sets only when
 * *it* launches the process. That held while the container ran `npm start`; Phase 1
 * changed the Dockerfile to `CMD ["node", "dist/shards.js"]` so the bot would be PID 1
 * and receive SIGTERM directly, and every version display silently became `0.0.0` or
 * `undefined` - the startup log, /about, the auth site, and the Application-Version
 * header sent to the Nexus Mods API.
 *
 * Nothing failed. It just quietly reported the wrong number, which is why this is a test
 * rather than a comment.
 */
/**
 * apps/bot/src and every package's src.
 *
 * The walk used to cover this workspace only, and the resolver has since moved into
 * @nexusmods/core - so the rule below would have stopped applying to the one file it is
 * actually about, and gone on passing. The reader moving out of the tree the rule walks
 * is how a rule quietly stops being a rule.
 */
const PACKAGES = path.join('..', '..', 'packages');

function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        for (const e of readdirSync(d)) {
            const p = path.join(d, e);
            if (statSync(p).isDirectory()) walk(p);
            else if (p.endsWith('.ts')) out.push(p);
        }
    };
    walk('src');
    for (const pkg of existsSync(PACKAGES) ? readdirSync(PACKAGES) : []) {
        const dir = path.join(PACKAGES, pkg, 'src');
        if (existsSync(dir)) walk(dir);
    }
    return out;
}

const slash = (f: string) => f.replace(/\\/g, '/').replace(/^\.\.\/\.\.\//, '');

describe('BOT_VERSION', () => {
    it('matches package.json', () => {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
        expect(BOT_VERSION).toBe(pkg.version);
    });

    it('is a real version, not a fallback', () => {
        expect(BOT_VERSION).not.toBe('0.0.0');
        expect(BOT_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('does not come from the environment', () => {
        // The fallback exists, but it must not be what is being used here: vitest is run
        // by npm, so npm_package_version is set, and a broken resolveVersion() would
        // still look correct without this.
        const saved = process.env.npm_package_version;
        process.env.npm_package_version = '9.9.9-wrong';
        try {
            const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
            expect(BOT_VERSION).toBe(pkg.version);
        }
        finally {
            if (saved === undefined) delete process.env.npm_package_version;
            else process.env.npm_package_version = saved;
        }
    });

    it('is the only place that reads npm_package_version', () => {
        // The resolver, wherever it lives. It is packages/core/src/packageVersion.ts now,
        // because the Nexus API client needs the same walk for its Application-Version.
        const RESOLVER = 'packages/core/src/packageVersion.ts';
        const offenders = sourceFiles().filter((f) => {
            if (slash(f) === RESOLVER) return false;
            // Comments explaining the history are fine; reads are not. Stripping them
            // rather than skipping lines that start with `//`: the history is now told in
            // a /** */ block whose lines start with `*`, and the line-prefix version of
            // this check reported version.ts for describing the bug it fixes.
            const code = readFileSync(f, 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            return code.includes('process.env.npm_package_version');
        }).map(slash);
        // Guard on the guard: a walk that returns nothing makes the assertion above
        // trivially true, and this one has already been narrowed once by a file moving.
        expect(sourceFiles().length).toBeGreaterThan(100);
        expect(offenders).toEqual([]);
    });
});
