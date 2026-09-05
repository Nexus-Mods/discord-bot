import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

describe('the shared surface', () => {
    /**
     * What both processes reach. Phase 4 turns this into packages, so what it depends on
     * stops being an internal detail and becomes each package's public dependency list.
     *
     * The rule this pins: **nothing shared may import discord.js at runtime.** The bot is
     * a gateway client and the web app is not, so a gateway library reached from shared
     * code is a dependency one side pays for and cannot use.
     *
     * It was true by one module until 5.0.0. `api/util.ts` imported EmbedBuilder for a
     * single helper, `unexpectedErrorEmbed`, and util.ts is reached from both sides - so
     * the web process loaded discord.js to build an embed only the bot ever rendered. The
     * helper moved to lib/embeds.ts, where the other eleven live and only the bot goes.
     *
     * Type-only imports are exempt, as everywhere else here: the compiler erases them, so
     * they cannot pull a module into a process.
     */
    const bot = reachableFrom(
        'src/shards.ts',
        'src/DiscordBot.ts',
        ...ALL.filter((f) => /^src[\\/](interactions|events)[\\/]/.test(f)),
    );
    const shared = [...web].filter((f) => bot.has(f)).sort();

    it('is the surface the packages will be cut from', () => {
        // Not an assertion about the number so much as a guard on the walk: a broken
        // resolver returns an empty set, and every test below would then pass by finding
        // nothing to complain about.
        expect(shared.length).toBeGreaterThan(20);
        expect(shared).toContain('src/db/schema.ts');
        expect(shared).toContain('src/api/queries/v2.ts');
    });

    it('does not reach discord.js at runtime', () => {
        const offenders = shared.filter((f) => importersOfPackage('discord.js').includes(f));
        expect(offenders).toEqual([]);
    });

    it('leaves the gateway library to the bot and the REST helpers to the web app', () => {
        // Stated rather than implied, because "no discord.js in shared" is only half the
        // rule. The web app legitimately uses REST, Routes, CDN and EmbedBuilder to talk
        // to Discord over HTTP - discordDirectory and forumWebhook - and that is a
        // different thing from holding a gateway connection.
        const gateway = importersOfPackage('discord.js').filter((f) => !shared.includes(f));
        for (const f of gateway) {
            expect(
                f.startsWith('src/server/') || bot.has(f),
                `${f} imports discord.js but is neither bot code nor the web app's REST layer`,
            ).toBe(true);
        }
    });
});

describe('the environment', () => {
    /**
     * The 5.0.0 move broke local startup and it took a fail-closed check to notice.
     *
     * Seven modules called `dotenv.config()`, which resolves .env from the working
     * directory. That was correct while the repository root and the bot were the same
     * directory. Once the bot moved to apps/bot, `npm start` ran with a working
     * directory holding no .env, every variable was missing, and the bot refused to
     * start with "Token encryption is not configured" - the 4.3.0 boot check reporting
     * an environment that had never been loaded.
     *
     * These pin the fix rather than the symptom: one resolver, and it goes first.
     */
    const ENTRY_POINTS = ['src/shards.ts', 'src/app.ts', 'src/web.ts', 'src/db/migrate.ts', 'src/db/backfillTokens.ts'];

    it('loads the environment in exactly one place', () => {
        const direct = ALL
            .filter((f) => slash(f) !== 'src/lib/env.ts')
            .filter((f) => /from '.?dotenv|import 'dotenv/.test(readFileSync(f, 'utf8')))
            .map(slash);
        expect(direct).toEqual([]);
    });

    it('has every entry point load it as its first import', () => {
        // Order is load-bearing: logger.ts reads process.env.SHARD_ID at module scope,
        // and ES imports run before any statement in the importing module - so an env
        // import placed after it would run too late to matter.
        for (const entry of ENTRY_POINTS) {
            const first = readFileSync(entry, 'utf8')
                .split('\n')
                .find((l) => l.startsWith('import '));
            expect(first, `${entry} should import the env loader first`).toMatch(/lib\/env\.js/);
        }
    });

    it('resolves .env from the code, not the working directory', async () => {
        // The property that actually matters, exercised rather than asserted about: a
        // file several levels above the module is found, whatever the cwd happens to be.
        const { findEnvFile } = await import('../../src/lib/env.js');
        const root = mkdtempSync(path.join(tmpdir(), 'envwalk-'));
        const deep = path.join(root, 'apps', 'bot', 'dist', 'lib');
        mkdirSync(deep, { recursive: true });
        writeFileSync(path.join(root, '.env'), 'EXAMPLE=1\n');
        expect(findEnvFile(deep)).toBe(path.join(root, '.env'));
        // And nothing invented when there is nothing to find.
        expect(findEnvFile(mkdtempSync(path.join(tmpdir(), 'envnone-')))).toBeUndefined();
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

    /**
     * Resolved from this file rather than the working directory. The 5.0.0 move put the
     * bot in apps/bot while the Dockerfile stayed at the repository root, so `readFileSync
     * ('Dockerfile')` - which had been correct for as long as the two were siblings -
     * started reading a path two levels below the file it wanted.
     */
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

    it('the Dockerfile default is the sharding manager', () => {
        // The exec form is what makes the bot PID 1 and lets it receive SIGTERM; the
        // shell form put /bin/sh there and `docker stop` had to SIGKILL it mid-poll.
        const dockerfile = readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
        expect(dockerfile).toContain('CMD ["node", "dist/shards.js"]');
    });

    it('the image still puts the bot where the deploy path expects it', () => {
        // The repository moved to apps/bot and the image deliberately did not: it keeps
        // dist/ and package.json directly under /app so `node dist/shards.js` stays
        // correct and redeploy.sh needs no change. If that stops being true, the deploy
        // breaks somewhere far from the cause.
        const dockerfile = readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
        expect(dockerfile).toContain('/repo/apps/bot/dist ./dist');
        expect(dockerfile).toContain('/repo/apps/bot/package.json ./package.json');
    });
});
