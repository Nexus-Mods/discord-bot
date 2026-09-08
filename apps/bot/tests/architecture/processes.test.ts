import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
/**
 * The universe is both workspaces, not just this one.
 *
 * Step 5 moves shared modules into packages/. If this kept walking only src/, every rule
 * below would stop applying to them the moment they left - and it would stop silently,
 * because "no module in the shared set imports discord.js" is trivially true of modules
 * the walk can no longer see. The packages are the shared set now; they are the last
 * place this should stop looking.
 */
const PACKAGES = path.join('..', '..', 'packages');

function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        for (const e of readdirSync(d)) {
            const p = path.join(d, e);
            if (statSync(p).isDirectory()) walk(p);
            else if (p.endsWith('.ts')) out.push(path.normalize(p));
        }
    };
    walk('src');
    for (const pkg of existsSync(PACKAGES) ? readdirSync(PACKAGES) : []) {
        const dir = path.join(PACKAGES, pkg, 'src');
        if (existsSync(dir)) walk(dir);
    }
    return out;
}

const ALL = sourceFiles();
// Package files come back as ../../packages/<name>/src/... because the walk starts here.
// Reported without the climb, so an assertion reads packages/core/src/logger.ts.
const slash = (f: string) => f.replace(/\\/g, '/').replace(/^\.\.\/\.\.\//, '');

const RELATIVE = /^\s*import\s+(type\s+)?(?:(\{[^}]*\})|([^'";]+?))?\s*(?:from\s*)?['"](\.[^'"]+)['"]/gm;
const BARE = /^\s*import\s+(type\s+)?(?:(\{[^}]*\})|([^'";]+?))?\s*(?:from\s*)?['"]([^.'"][^'"]*)['"]/gm;

function isTypeOnly(typeKeyword: string | undefined, braces: string | undefined): boolean {
    if (typeKeyword) return true;
    if (!braces) return false;
    const names = braces.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
    return names.length === 0 || names.every((n) => /^type\s/.test(n));
}

/**
 * A workspace subpath import, mapped back to the source file it will resolve to.
 *
 * `@nexusmods/core/logger.js` is packages/core/src/logger.ts. Without this the graph
 * would break in half at the package boundary, and a boundary that is invisible to the
 * test that guards it is worse than no test.
 */
const WORKSPACE = /^@nexusmods\/([^/]+)\/(.+)\.js$/;

function workspaceSource(spec: string): string | undefined {
    const m = WORKSPACE.exec(spec);
    if (!m) return undefined;
    return path.normalize(path.join(PACKAGES, m[1], 'src', `${m[2]}.ts`));
}

/** Runtime imports of local modules, resolved to source paths. */
function localDeps(file: string): string[] {
    const deps: string[] = [];
    for (const m of readFileSync(file, 'utf8').matchAll(RELATIVE)) {
        if (isTypeOnly(m[1], m[2])) continue;
        const resolved = path.normalize(path.join(path.dirname(file), m[4].replace(/\.js$/, '.ts')));
        if (ALL.includes(resolved)) deps.push(resolved);
    }
    for (const m of readFileSync(file, 'utf8').matchAll(BARE)) {
        if (isTypeOnly(m[1], m[2])) continue;
        const resolved = workspaceSource(m[4]);
        if (resolved && ALL.includes(resolved)) deps.push(resolved);
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
        expect(web.has('packages/persistence/src/subscriptions.ts')).toBe(true);
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
     *
     * src/auth/ is now packages/auth. The directory was always the shape of a package
     * waiting for one; 5.0.0 gave it the name.
     */
    it('is reachable only from the web entry point and its own modules', () => {
        const offenders = ALL
            .filter((f) => localDeps(f).some((d) => slash(d).startsWith('src/server/')))
            .map(slash)
            .filter((f) => f !== 'src/web.ts' && !f.startsWith('src/server/'));
        expect(offenders).toEqual([]);
    });
});

describe('@nexusmods/auth', () => {
    /**
     * Shared by both processes, so it must stay free of anything that belongs to only
     * one of them: no express, and no gateway client.
     */
    it('does not pull express or the gateway into whichever process imports it', () => {
        const authFiles = ALL.filter((f) => slash(f).startsWith('packages/auth/src/'));
        expect(authFiles.length).toBeGreaterThan(0);
        expect(importersOfPackage('express').filter((f) => f.startsWith('packages/auth/'))).toEqual([]);
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
        expect(shared).toContain('packages/persistence/src/schema.ts');
        expect(shared).toContain('packages/nexus-api/src/queries/v2.ts');
    });

    it('does not reach discord.js at runtime', () => {
        const offenders = shared.filter((f) => importersOfPackage('discord.js').includes(f));
        expect(offenders).toEqual([]);
    });

    /**
     * The cut packages are the shared surface made explicit, so they get the rule twice:
     * once here as part of `shared`, and once below by their path - because a module in
     * packages/ that no entry point happens to reach today would drop out of `shared`
     * and out of the rule with it.
     */
    const packaged = ALL.map(slash).filter((f) => f.startsWith('packages/'));

    it('is where the packages live, and the walk can see them', () => {
        expect(packaged.length).toBeGreaterThan(0);
        expect(shared.some((f) => f.startsWith('packages/'))).toBe(true);
    });

    it('keeps single-process libraries out of the packages entirely', () => {
        // discord.js belongs to the bot, express and its middleware to the web app. A
        // package reaching either is a dependency half its consumers pay for and none of
        // them asked for.
        for (const pkg of ['discord.js', 'express', 'helmet', 'express-rate-limit', 'cookie-parser', 'ejs']) {
            const offenders = importersOfPackage(pkg).filter((f) => f.startsWith('packages/'));
            expect(offenders, `${pkg} is reached from a package`).toEqual([]);
        }
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

    // Resolved from this file: the working directory is apps/bot and apps/web is a sibling.
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

    it('loads the environment in exactly one place', () => {
        const direct = ALL
            .filter((f) => slash(f) !== 'packages/core/src/env.ts')
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
            expect(first, `${entry} should import the env loader first`).toMatch(/@nexusmods\/core\/env\.js/);
        }
    });

    /**
     * apps/web is a second application with its own idea of where .env is.
     *
     * Next reads .env from its own project directory, so the repository's root .env - the
     * only one there is - reached the bot and not the web app. `npm run dev:web` came up
     * and then refused to serve, because COOKIE_SECRET is in that file and the boot check
     * could not see it. Exactly the 5.0.0 failure that put the resolver in a package,
     * repeated in an application built after it.
     *
     * next.config.ts is where it has to go: the earliest file Next evaluates, and it
     * evaluates it for `dev`, `build` and `start` alike.
     */
    it('has the web app load it too, before anything else it imports', () => {
        const config = readFileSync(path.join(root, 'apps', 'web', 'next.config.ts'), 'utf8');
        const first = config.split('\n').find((l) => l.startsWith('import '));
        expect(first, 'apps/web/next.config.ts should import the env loader first')
            .toMatch(/@nexusmods\/core\/env\.js/);
    });

    it('has nothing in the web app reaching for dotenv on its own', () => {
        const offenders: string[] = [];
        (function walk(d: string) {
            for (const e of readdirSync(d)) {
                if (e === 'node_modules' || e === '.next') continue;
                const f = path.join(d, e);
                if (statSync(f).isDirectory()) walk(f);
                else if (/\.tsx?$/.test(f) && /from '.?dotenv|import 'dotenv/.test(readFileSync(f, 'utf8'))) {
                    offenders.push(slash(f));
                }
            }
        })(path.join(root, 'apps', 'web'));
        expect(offenders).toEqual([]);
    });

    it('resolves .env from the code, not the working directory', async () => {
        // The property that actually matters, exercised rather than asserted about: a
        // file several levels above the module is found, whatever the cwd happens to be.
        const { findEnvFile } = await import('@nexusmods/core/env.js');
        const root = mkdtempSync(path.join(tmpdir(), 'envwalk-'));
        const deep = path.join(root, 'apps', 'bot', 'dist', 'lib');
        mkdirSync(deep, { recursive: true });
        writeFileSync(path.join(root, '.env'), 'EXAMPLE=1\n');
        expect(findEnvFile(deep)).toBe(path.join(root, '.env'));
        // And nothing invented when there is nothing to find.
        expect(findEnvFile(mkdtempSync(path.join(tmpdir(), 'envnone-')))).toBeUndefined();
    });
});

describe('workspace versions', () => {
    /**
     * One version across the repository, and it is load-bearing now.
     *
     * The `Application-Version` the Nexus Mods API sees is @nexusmods/nexus-api's own
     * package version, because the account model had to become a package and `baseheader`
     * was the one import holding it in the application - a package cannot resolve the
     * application's version, it finds its own manifest.
     *
     * That is only the bot's version because everything here is released together. This is
     * what makes "released together" a rule rather than a habit: bump one workspace on its
     * own and the header quietly stops naming the bot, which nothing else would notice.
     */
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

    it('are all the root version', () => {
        const rootManifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
        const found: [string, unknown][] = [];

        for (const pattern of rootManifest.workspaces as string[]) {
            const dir = path.join(root, pattern.replace(/\/\*$/, ''));
            for (const entry of readdirSync(dir)) {
                const manifest = path.join(dir, entry, 'package.json');
                if (!existsSync(manifest)) continue;
                found.push([entry, JSON.parse(readFileSync(manifest, 'utf8')).version]);
            }
        }

        // Guard on the walk: an empty list agrees with anything.
        expect(found.length).toBeGreaterThan(4);
        for (const [name, version] of found) {
            expect(version, `${name} is not on the root version`).toBe(rootManifest.version);
        }
    });
});

describe('declared dependencies', () => {
    /**
     * A workspace that imports another must say so in its own package.json.
     *
     * npm links every workspace into the root node_modules whether anything depends on it
     * or not, so an undeclared workspace dependency resolves perfectly on a developer's
     * machine and in CI. It stops resolving where the tree is deliberately narrowed:
     * `npm ci --workspace @nexusmods/discord-bot` in the Dockerfile installs one
     * workspace's dependency tree, and the manifests it COPYs are chosen by reading that
     * list. A dependency missing from the list is a dependency missing from the image.
     *
     * apps/web was importing @nexusmods/auth and @nexusmods/core undeclared from step 7
     * onwards - four modules by step 9 - and nothing anywhere failed. It would have failed
     * in step 10, on the first build of the web image, as a module resolution error inside
     * Docker with a working local build to compare it against.
     */
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

    /** Every workspace directory, with its manifest. */
    function workspaces(): { name: string; dir: string; manifest: Record<string, any> }[] {
        const rootManifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
        const found: { name: string; dir: string; manifest: Record<string, any> }[] = [];
        for (const pattern of rootManifest.workspaces as string[]) {
            const parent = path.join(root, pattern.replace(/\/\*$/, ''));
            for (const entry of readdirSync(parent)) {
                const dir = path.join(parent, entry);
                const manifest = path.join(dir, 'package.json');
                if (!existsSync(manifest)) continue;
                found.push({ name: entry, dir, manifest: JSON.parse(readFileSync(manifest, 'utf8')) });
            }
        }
        return found;
    }

    /**
     * `@nexusmods/<name>` in a quoted module specifier, anywhere under a directory -
     * source, tests and config files alike, since a test's imports need declaring too.
     *
     * Quoted, which matters. The first version matched the name anywhere on the grounds
     * that a package named in a comment is one somebody expects to be there, and it
     * reported two offenders that were both prose: a sentence in packageVersion.ts
     * explaining what the resolver finds, and a comment in this very file mapping apps/web
     * to @nexusmods/discord-web. That is the third rule here to read its own documentation
     * as a violation, after the npm_package_version check and the route segment checks. A
     * quoted specifier is an import; a name in a sentence is a sentence.
     *
     * It also skips the regex literals in the vitest configs, which spell the scope out
     * without importing anything from it.
     */
    const SPECIFIER = /['"]@nexusmods\/([a-z0-9-]+)(?:\/[^'"]*)?['"]/g;

    function imported(dir: string): Set<string> {
        const names = new Set<string>();
        const walk = (d: string) => {
            for (const e of readdirSync(d)) {
                if (e === 'node_modules' || e === 'dist' || e === '.next') continue;
                const p = path.join(d, e);
                if (statSync(p).isDirectory()) { walk(p); continue; }
                if (!/\.(ts|tsx|mts|mjs)$/.test(e)) continue;
                for (const m of readFileSync(p, 'utf8').matchAll(SPECIFIER)) names.add(m[1]);
            }
        };
        walk(dir);
        return names;
    }

    it('names every workspace it imports', () => {
        const all = workspaces();
        expect(all.length).toBeGreaterThan(4);

        // Directory name to package name, since they differ: apps/web is @nexusmods/discord-web.
        const packageOf = new Map(all.map((w) => [w.name, w.manifest.name as string]));
        const offenders: string[] = [];

        for (const w of all) {
            const declared = new Set([
                ...Object.keys(w.manifest.dependencies ?? {}),
                ...Object.keys(w.manifest.devDependencies ?? {}),
            ]);
            for (const dirName of imported(w.dir)) {
                // The scope is shared with the package names, so resolve both spellings.
                const spelling = packageOf.get(dirName) ?? `@nexusmods/${dirName}`;
                if (spelling === w.manifest.name) continue; // itself
                if (declared.has(spelling)) continue;
                offenders.push(`${w.manifest.name} imports ${spelling} without declaring it`);
            }
        }

        expect([...new Set(offenders)]).toEqual([]);
    });
});

describe('the lint config', () => {
    /**
     * A file nothing lints looks exactly like a file with no problems.
     *
     * The config used to list directories - apps/*\/src, then tests, then app/ when
     * apps/web arrived. Each time something appeared outside those, eslint reported "File
     * ignored because no matching configuration was supplied" as a warning and exited 0,
     * so `npm run lint` passed while checking none of it. It happened to apps/web, and
     * then to all four packages: 46 modules stopped being linted the moment they were
     * moved into packages/, and stayed that way for four commits.
     *
     * The patterns name the workspace roots now, so a new directory inside one is covered
     * the day it exists. This is what is left to get wrong: a third workspace root.
     */
    // Same climb as the Dockerfile assertions below: resolved from this file, because the
    // working directory is apps/bot and the config is at the repository root.
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

    it('has a pattern for every workspace root', () => {
        const roots: string[] = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
            .workspaces.map((w: string) => w.replace(/\/\*$/, ''));
        expect(roots.length).toBeGreaterThan(0);

        const config = readFileSync(path.join(root, 'eslint.config.mjs'), 'utf8');
        for (const workspace of roots) {
            expect(config, `${workspace}/ has no lint pattern`).toContain(`"${workspace}/*/**/*.{ts,tsx}"`);
        }
    });
});

describe('test doubles', () => {
    /**
     * A mocked module id is a string in a function call. Nothing typechecks it and nothing
     * follows it when the module moves - and a stale one does not error: vitest mocks a
     * module nobody imports, the real one runs, and the failure surfaces wherever that
     * module first does something it was mocked to avoid.
     *
     * The auth cut did exactly this. Both auth mocks in link-flow.test.ts kept pointing at
     * src/auth/, the real DiscordOAuth ran, found no client id, returned '/oauth-error',
     * and five tests failed inside `new URL(location)`.
     */
    const MOCKED = /vi\.(?:mock|doMock)\(\s*['"]([^'"]+)['"]/g;

    /**
     * Both suites, not just this one.
     *
     * apps/web had no mocks at all until step 9, when the OAuth routes arrived with four -
     * and its aliases are a third spelling this rule has to know about, `@/lib/...`
     * resolved against apps/web rather than against the file doing the mocking. A rule that
     * walks only apps/bot/tests would report zero offenders in the suite most likely to
     * grow a stale one, since the web app's module layout is the newest.
     */
    const WEB = path.join('..', 'web');

    function testFiles(): string[] {
        const out: string[] = [];
        const walk = (d: string) => {
            for (const e of readdirSync(d)) {
                const p = path.join(d, e);
                if (statSync(p).isDirectory()) walk(p);
                else if (p.endsWith('.ts')) out.push(p);
            }
        };
        walk('tests');
        walk(path.join(WEB, 'tests'));
        return out;
    }

    /** `@/x` in a web test is apps/web/x. Returns undefined for a file outside apps/web. */
    function webAlias(file: string, spec: string): string | undefined {
        if (!path.resolve(file).startsWith(path.resolve(WEB))) return undefined;
        const bare = path.join(WEB, spec.slice(2).replace(/\.js$/, ''));
        // A module id carries no extension; the file is .ts or .tsx.
        return ['.ts', '.tsx'].map((ext) => `${bare}${ext}`).find((c) => existsSync(c)) ?? `${bare}.ts`;
    }

    it('every mocked local module id resolves to a file', () => {
        const offenders: string[] = [];
        let seen = 0;
        for (const f of testFiles()) {
            for (const m of readFileSync(f, 'utf8').matchAll(MOCKED)) {
                const spec = m[1];
                let resolved: string | undefined;
                if (spec.startsWith('.')) resolved = path.join(path.dirname(f), spec.replace(/\.js$/, '.ts'));
                else if (spec.startsWith('@nexusmods/')) resolved = workspaceSource(spec);
                else if (spec.startsWith('@/')) resolved = webAlias(f, spec);
                else continue; // a real npm package; node resolves it or the test fails loudly
                if (resolved === undefined) continue;
                seen += 1;
                if (!resolved || !existsSync(resolved)) offenders.push(`${slash(f)} mocks ${spec}`);
            }
        }
        // A regex that stops matching would make the loop above vacuous.
        expect(seen).toBeGreaterThan(0);
        expect(offenders).toEqual([]);
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

    it('flattens the workspace links so node_modules is self-contained', () => {
        // The runtime stage copies node_modules and nothing else. npm does not install a
        // workspace dependency, it links it - so without this step /app/node_modules/
        // @nexusmods/core points at /app/packages/core, which the image does not have,
        // and the bot dies on its first import. Nothing else in the build would fail.
        const dockerfile = readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
        expect(dockerfile).toMatch(/RUN node scripts\/flatten-workspace-deps\.mjs/);
        // And after the prune, which rewrites the tree it is rewriting.
        expect(dockerfile.indexOf('npm prune')).toBeLessThan(dockerfile.indexOf('flatten-workspace-deps'));
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
