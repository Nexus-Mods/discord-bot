import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
function sourceFiles(): string[] {
    const out: string[] = [];
    (function walk(d: string) {
        for (const e of readdirSync(d)) {
            const p = path.join(d, e);
            if (statSync(p).isDirectory()) walk(p);
            else if (p.endsWith('.ts')) out.push(p);
        }
    })('src');
    return out;
}

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
        const offenders = sourceFiles().filter((f) => {
            if (f === path.join('src', 'version.ts')) return false;
            const body = readFileSync(f, 'utf8');
            // Comments explaining the history are fine; reads are not.
            return body.split('\n').some((line) =>
                line.includes('process.env.npm_package_version') && !line.trimStart().startsWith('//'));
        });
        expect(offenders).toEqual([]);
    });
});
