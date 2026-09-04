import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Pins the process split.
 *
 * The auth site used to be constructed inside the bot and skipped on every shard but 0,
 * which made "does this run in the web process or the bot process?" a question you could
 * only answer by reading a constructor. They are separate processes now, and the cheapest
 * way for that to quietly stop being true is an import: one `import { AuthSite }` in a
 * command handler puts express back inside the gateway process and nothing else fails.
 *
 * Most assertions here are of the form "which files import X", not "what can this entry
 * point reach". Reachability is the obvious approach and it does not work on this
 * codebase: shards.ts spawns dist/app.js by path rather than importing it, and
 * DiscordBot.ts loads every command and event by readdir and dynamic import(). A walk
 * from the bot's entry points reaches 31 of 101 modules, so "express is not among them"
 * would pass while being false.
 *
 * Runtime imports only. Type-only imports are erased by the compiler and cannot pull a
 * module into a process - the same rule the cycles test uses, for the same reason.
 */
function sourceFiles(): string[] {
    const out: string[] = [];
    (function walk(d: string) {
        for (const e of readdirSync(d)) {
            const p = path.join(d, e);
            if (statSync(p).isDirectory()) walk(p);
            else if (p.endsWith('.ts')) out.push(path.normalize(p));
        }
    })('src');
    return out;
}

const ALL = sourceFiles();
const slash = (f: string) => f.replace(/\\/g, '/');

const RELATIVE = /^\s*import\s+(type\s+)?(?:(\{[^}]*\})|([^'";]+?))?\s*(?:from\s*)?['"](\.[^'"]+)['"]/gm;
const BARE = /^\s*import\s+(type\s+)?(?:(\{[^}]*\})|([^'";]+?))?\s*(?:from\s*)?['"]([^.'"][^'"]*)['"]/gm;

function isTypeOnly(typeKeyword: string | undefined, braces: string | undefined): boolean {
    if (typeKeyword) return true;
    if (!braces) return false;
    const names = braces.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
    return names.length === 0 || names.every((n) => /^type\s/.test(n));
}

/** Runtime imports of local modules, resolved to source paths. */
function localDeps(file: string): string[] {
    const deps: string[] = [];
    for (const m of readFileSync(file, 'utf8').matchAll(RELATIVE)) {
        if (isTypeOnly(m[1], m[2])) continue;
        const resolved = path.normalize(path.join(path.dirname(file), m[4].replace(/\.js$/, '.ts')));
        if (ALL.includes(resolved)) deps.push(resolved);
    }
    return deps;
}

/** Files that import the given local module at runtime. */
function importersOf(target: string): string[] {
    const want = path.normalize(target);
    return ALL.filter((f) => localDeps(f).includes(want)).map(slash).sort();
}

/** Files that import the given package at runtime. */
function importersOfPackage(pkg: string): string[] {
    return ALL.filter((f) => {
        for (const m of readFileSync(f, 'utf8').matchAll(BARE)) {
            if (m[4] !== pkg && !m[4].startsWith(`${pkg}/`)) continue;
            if (!isTypeOnly(m[1], m[2])) return true;
        }
        return false;
    }).map(slash).sort();
}

function reachableFrom(...entries: string[]): Set<string> {
    const seen = new Set<string>();
    const queue = entries.map((e) => path.normalize(e));
    while (queue.length) {
        const f = queue.pop()!;
        if (seen.has(f)) continue;
        seen.add(f);
        queue.push(...localDeps(f));
    }
    return new Set([...seen].map(slash));
}

const web = reachableFrom('src/web.ts');

describe('the web server stays out of the bot process', () => {
    it('is constructed by the web entry point and nowhere else', () => {
        expect(importersOf('src/server/server.ts')).toEqual(['src/web.ts']);
    });

    // Only server.ts imports express at runtime; the handlers take `import type express`
    // for their Request/Response annotations, which the compiler erases.
    it('is the only place express is imported at runtime', () => {
        expect(importersOfPackage('express')).toEqual(['src/server/server.ts']);
    });

    it('keeps express-only middleware out of the rest of the tree', () => {
        for (const pkg of ['helmet', 'express-rate-limit', 'cookie-parser', 'ejs']) {
            for (const f of importersOfPackage(pkg)) {
                expect(f.startsWith('src/server/')).toBe(true);
            }
        }
    });
});

describe('the bot stays out of the web process', () => {
    // Guard on the guard: every "not in this set" assertion below is trivially true of
    // an empty set, and the reachability walk is exactly the kind of thing that silently
    // returns one.
    it('reaches a realistic module count from src/web.ts', () => {
        expect(web.size).toBeGreaterThan(15);
    });

    it('does not construct a gateway client', () => {
        expect([...web].filter((f) => f === 'src/DiscordBot.ts')).toEqual([]);
    });

    it('does not load the feed managers or the command tree', () => {
        expect([...web].filter((f) => f.startsWith('src/feeds/'))).toEqual([]);
        expect([...web].filter((f) => f.startsWith('src/interactions/'))).toEqual([]);
        expect([...web].filter((f) => f.startsWith('src/events/'))).toEqual([]);
    });

    // Two routes used to carry EmbedBuilder into the web process: api/users re-exported
    // lib/profile, and types/subscriptions carried 380 lines of embed rendering. A data
    // layer that renders Discord embeds is one a web app cannot share.
    it('does not load Discord presentation code', () => {
        expect([...web].filter((f) => f === 'src/lib/embeds.ts' || f === 'src/lib/profile.ts')).toEqual([]);
        expect(web.has('src/feeds/subscriptionEmbeds.ts')).toBe(false);
    });

    it('reads subscriptions without constructing Discord I/O', () => {
        expect(web.has('src/api/subscriptions.ts')).toBe(true);
        expect(web.has('src/feeds/webhooks.ts')).toBe(false);
    });

    it('reaches Discord only through the REST directory', () => {
        expect(web.has('src/server/discordDirectory.ts')).toBe(true);
    });

    it('has no module under src/server/ depending on the bot', () => {
        const offenders = ALL
            .filter((f) => slash(f).startsWith('src/server/'))
            .filter((f) => localDeps(f).some((d) => /DiscordBot\.ts$|[\\/]feeds[\\/]/.test(d)))
            .map(slash);
        expect(offenders).toEqual([]);
    });

    /**
     * The other direction, and the reason src/auth/ exists.
     *
     * Before the 4.4.0 split, the bot reached into src/server/ for three things:
     * DiscordBotUser imported both OAuth clients, and the link and unlink commands
     * imported the URL signing helpers. Those are not web-server code - they are shared
     * primitives that happened to live next to express - and while they stayed there,
     * "the web app" and "things both processes need" were the same directory, so the
     * eventual package cut had no line to follow.
     *
     * src/server/ is now web-only: reachable from src/web.ts and from its own modules,
     * and from nowhere else. This test is what stops that eroding one convenient import
     * at a time.
     */
    it('is reachable only from the web entry point and its own modules', () => {
        const offenders = ALL
            .filter((f) => localDeps(f).some((d) => slash(d).startsWith('src/server/')))
            .map(slash)
            .filter((f) => f !== 'src/web.ts' && !f.startsWith('src/server/'));
        expect(offenders).toEqual([]);
    });
});

describe('src/auth/', () => {
    /**
     * Shared by both processes, so it must stay free of anything that belongs to only
     * one of them: no express, and no gateway client.
     */
    it('does not pull express or the gateway into whichever process imports it', () => {
        const authFiles = ALL.filter((f) => slash(f).startsWith('src/auth/'));
        expect(authFiles.length).toBeGreaterThan(0);
        expect(importersOfPackage('express').filter((f) => f.startsWith('src/auth/'))).toEqual([]);
        for (const f of authFiles) {
            for (const dep of localDeps(f)) {
                expect(slash(dep), `${slash(f)} reaches the bot`).not.toMatch(/DiscordBot\.ts$/);
                expect(slash(dep), `${slash(f)} reaches the web app`).not.toMatch(/^src\/server\//);
            }
        }
    });
});

describe('entry points', () => {
    // Two containers from one image start in either order. runMigrations takes a Postgres
    // advisory lock, so whichever wins does the work and the other finds nothing to do.
    it.each(['src/shards.ts', 'src/web.ts'])('%s migrates before it starts', (entry) => {
        expect(reachableFrom(entry).has('src/db/migrate.ts')).toBe(true);
    });

    // app.ts is the shard child, spawned by shards.ts after it has already migrated.
    // If it migrates too, every shard races on the lock at startup for nothing.
    it('the shard child does not migrate', () => {
        expect(reachableFrom('src/app.ts').has('src/db/migrate.ts')).toBe(false);
    });

    // The unsharded path is gone: it is what let local runs take `if (!client.shard)`
    // branches production never takes. There is one way to start the bot.
    it('npm start runs the sharding manager, not the shard child', () => {
        const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>;
        expect(scripts.start).toBe('node dist/shards.js');
        const startsTheChild = Object.entries(scripts)
            .filter(([, cmd]) => /\bdist\/app\.js\b/.test(cmd))
            .map(([name]) => name);
        expect(startsTheChild).toEqual([]);
    });

    it('the Dockerfile default is the sharding manager', () => {
        expect(readFileSync('Dockerfile', 'utf8')).toContain('CMD ["node", "dist/shards.js"]');
    });
});
