import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pins the process split: one stray `import { AuthSite }` would put express back inside
 * the gateway process and nothing else would fail.
 *
 * Mostly "which files import X" rather than "what can this entry point reach" -
 * reachability under-reports here, because shards.ts spawns its child by path and
 * DiscordBot.ts loads commands by readdir and dynamic import().
 *
 * Runtime imports only; type-only imports are erased and cannot pull a module into a
 * process. The walk covers both workspaces, since the shared set now lives in packages/.
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

/** `@nexusmods/core/logger.js` -> packages/core/src/logger.ts, so the graph spans packages. */
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

describe('@nexusmods/auth', () => {
    /** Imported by both applications, so it must stay free of what belongs to one. */
    it('does not pull the gateway into whichever process imports it', () => {
        const authFiles = ALL.filter((f) => slash(f).startsWith('packages/auth/src/'));
        expect(authFiles.length).toBeGreaterThan(0);
        for (const f of authFiles) {
            for (const dep of localDeps(f)) {
                expect(slash(dep), `${slash(f)} reaches the bot`).not.toMatch(/DiscordBot\.ts$/);
            }
        }
    });
});

describe('the shared surface', () => {
    /**
     * The packages are what both applications import, and apps/web is a separate workspace
     * that cannot reach into this one - so the surface is the packages by definition, and
     * the rule is what may not appear in them.
     */
    const packaged = ALL.map(slash).filter((f) => f.startsWith('packages/'));

    it('is where the packages live, and the walk can see them', () => {
        // A guard on the walk: a broken resolver returns an empty set and passes everything.
        expect(packaged.length).toBeGreaterThan(20);
        expect(packaged).toContain('packages/persistence/src/schema.ts');
        expect(packaged).toContain('packages/nexus-api/src/queries/v2.ts');
    });

    it('keeps single-process libraries out of the packages entirely', () => {
        // discord.js is the gateway client: a package reaching it is a dependency the web
        // app pays for and cannot use. express and its middleware are gone from the
        // repository altogether, and are named so that reintroducing one is deliberate.
        for (const pkg of ['discord.js', 'express', 'helmet', 'express-rate-limit', 'cookie-parser', 'ejs']) {
            const offenders = importersOfPackage(pkg).filter((f) => f.startsWith('packages/'));
            expect(offenders, `${pkg} is reached from a package`).toEqual([]);
        }
    });

    it('leaves the gateway library to the bot alone', () => {
        const offenders = importersOfPackage('discord.js').filter((f) => !slash(f).startsWith('src/'));
        expect(offenders, 'discord.js is reached from outside the bot').toEqual([]);
    });
});

describe('express is gone', () => {
    /**
     * The auth site is apps/web, and this workspace has no HTTP server at all. The
     * dependencies are uninstalled, so an import would fail the build - this says which
     * ones and why, so putting one back is a decision rather than an accident.
     */
    it('is not imported anywhere in this workspace', () => {
        for (const pkg of ['express', 'helmet', 'express-rate-limit', 'cookie-parser', 'ejs']) {
            expect(importersOfPackage(pkg), `${pkg} is back`).toEqual([]);
        }
    });

    it('is not a dependency of this workspace', () => {
        const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
        const declared = { ...manifest.dependencies, ...manifest.devDependencies };
        for (const pkg of ['express', 'helmet', 'express-rate-limit', 'cookie-parser', 'ejs', '@types/express']) {
            expect(pkg in declared, `${pkg} is declared again`).toBe(false);
        }
    });

    it('leaves no entry point that would start one', () => {
        expect(existsSync('src/web.ts'), 'src/web.ts is back').toBe(false);
        expect(existsSync('src/server'), 'src/server/ is back').toBe(false);
        const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>;
        expect(Object.values(scripts).filter((c) => /dist\/web\.js/.test(c))).toEqual([]);
    });
});

describe('the environment', () => {
    // One env resolver, loaded first. dotenv.config() resolves from the working
    // directory, which differs between the repository root, apps/bot and the image.
    const ENTRY_POINTS = ['src/shards.ts', 'src/app.ts', 'src/db/migrate.ts', 'src/db/backfillTokens.ts'];

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
        // Order is load-bearing: logger.ts reads SHARD_ID at module scope, and imports run
        // before any statement in the importing module.
        for (const entry of ENTRY_POINTS) {
            const first = readFileSync(entry, 'utf8')
                .split('\n')
                .find((l) => l.startsWith('import '));
            expect(first, `${entry} should import the env loader first`).toMatch(/@nexusmods\/core\/env\.js/);
        }
    });

    // Next reads .env from its own project directory, so the root .env never reaches the
    // web app. next.config.ts is the earliest file it evaluates, for dev, build and start.
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
        // The property that matters: a file several levels up is found, whatever the cwd.
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
     * One version across the repository. The Application-Version header the Nexus Mods API
     * sees is @nexusmods/nexus-api's own, so bumping a workspace alone would quietly stop
     * it naming the bot.
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
     * A workspace that imports another must declare it. npm links every workspace into the
     * root node_modules regardless, so an undeclared dependency resolves locally and in CI
     * and fails only where the tree is narrowed - `npm ci --workspace X` in a Dockerfile.
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
     * Quoted specifiers in an importing position only. A name in a comment is a sentence,
     * and `npm run dev -w @nexusmods/discord-web` in dev.mjs is a workspace argument -
     * neither is an import.
     */
    const SPECIFIER = /(?:from|import|require|vi\.mock|vi\.doMock)\s*\(?\s*['"]@nexusmods\/([a-z0-9-]+)(?:\/[^'"]*)?['"]/g;

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

describe('build order', () => {
    /**
     * A declared dependency has to be built, not just declared. The packages' exports map
     * answers the types condition from src/ and the runtime condition from dist/, so
     * typecheck needs no build and anything that resolves a package does. The chain lives
     * once at the root as `build:packages`; these rules stop it going stale.
     */
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
    const manifest = (p: string) => JSON.parse(readFileSync(path.join(root, p, 'package.json'), 'utf8'));

    it('has every application building the packages first', () => {
        const apps = readdirSync(path.join(root, 'apps'))
            .filter((e) => existsSync(path.join(root, 'apps', e, 'package.json')));
        expect(apps.length).toBeGreaterThan(1);

        for (const app of apps) {
            const build = manifest(path.join('apps', app)).scripts?.build ?? '';
            expect(build, `apps/${app} does not build the packages before building itself`)
                .toContain('build:packages');
        }
    });

    it('builds every package any workspace depends on', () => {
        const rootManifest = manifest('.');
        const chain: string = rootManifest.scripts['build:packages'];
        expect(chain).toBeTruthy();

        // Which packages the chain actually builds.
        const built = new Set([...chain.matchAll(/--prefix packages\/([a-z0-9-]+)/g)].map((m) => m[1]));
        expect(built.size).toBeGreaterThan(3);

        // Every @nexusmods package depended on by anything, as a directory name.
        const dirOf = new Map<string, string>();
        for (const pattern of rootManifest.workspaces as string[]) {
            const parent = path.join(root, pattern.replace(/\/\*$/, ''));
            for (const entry of readdirSync(parent)) {
                const file = path.join(parent, entry, 'package.json');
                if (!existsSync(file)) continue;
                dirOf.set(JSON.parse(readFileSync(file, 'utf8')).name, entry);
            }
        }

        const needed = new Set<string>();
        for (const pattern of rootManifest.workspaces as string[]) {
            const rel = pattern.replace(/\/\*$/, '');
            for (const entry of readdirSync(path.join(root, rel))) {
                if (!existsSync(path.join(root, rel, entry, 'package.json'))) continue;
                for (const dep of Object.keys(manifest(path.join(rel, entry)).dependencies ?? {})) {
                    if (!dep.startsWith('@nexusmods/')) continue;
                    const dir = dirOf.get(dep);
                    // Only the packages: an app depending on an app is not a build input here.
                    if (dir && existsSync(path.join(root, 'packages', dir))) needed.add(dir);
                }
            }
        }

        const unbuilt = [...needed].filter((d) => !built.has(d)).sort();
        expect(unbuilt, 'depended on but never built by build:packages').toEqual([]);
    });
});

describe('the lint config', () => {
    /**
     * A file nothing lints looks exactly like a file with no problems: eslint reports "File
     * ignored because no matching configuration was supplied" as a WARNING and exits 0.
     * The patterns name the workspace roots, so what is left to get wrong is a third root.
     */
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
     * A stale mocked module id does not error: vitest mocks a module nobody imports, the
     * real one runs, and the failure surfaces somewhere else entirely.
     */
    const MOCKED = /vi\.(?:mock|doMock)\(\s*['"]([^'"]+)['"]/g;

    // Both suites: apps/web's tests mock too, and spell their aliases as `@/lib/...`.
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
    // Since 5.0.0 the bot is the only process that migrates: the web app is a separate
    // image and cannot import this. The advisory lock in runMigrations still guards
    // against two bot containers overlapping during a redeploy.
    it('migrates before it starts', () => {
        const entry = 'src/shards.ts';
        expect(reachableFrom(entry).has('src/db/migrate.ts')).toBe(true);
    });

    // app.ts is the shard child: if it migrates too, every shard races on the lock.
    it('the shard child does not migrate', () => {
        expect(reachableFrom('src/app.ts').has('src/db/migrate.ts')).toBe(false);
    });

    // There is one way to start the bot; no unsharded branches production never takes.
    it('npm start runs the sharding manager, not the shard child', () => {
        const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>;
        expect(scripts.start).toBe('node dist/shards.js');
        const startsTheChild = Object.entries(scripts)
            .filter(([, cmd]) => /\bdist\/app\.js\b/.test(cmd))
            .map(([name]) => name);
        expect(startsTheChild).toEqual([]);
    });

    // Resolved from this file: the working directory is apps/bot, the Dockerfile is at the root.
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

    it('the Dockerfile default is the sharding manager', () => {
        // Exec form: the shell form puts /bin/sh at PID 1, which swallows SIGTERM.
        const dockerfile = readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
        expect(dockerfile).toContain('CMD ["node", "dist/shards.js"]');
    });

    it('flattens the workspace links so node_modules is self-contained', () => {
        // npm LINKS a workspace dependency, and the runtime stage copies node_modules
        // without packages/ - so without this the links dangle and nothing else fails.
        const dockerfile = readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
        expect(dockerfile).toMatch(/RUN node scripts\/flatten-workspace-deps\.mjs/);
        // And after the prune, which rewrites the tree it is rewriting.
        expect(dockerfile.indexOf('npm prune')).toBeLessThan(dockerfile.indexOf('flatten-workspace-deps'));
    });

    it('the image still puts the bot where the deploy path expects it', () => {
        // The image keeps dist/ and package.json directly under /app, so
        // `node dist/shards.js` stays correct and redeploy.sh needs no change.
        const dockerfile = readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
        expect(dockerfile).toContain('/repo/apps/bot/dist ./dist');
        expect(dockerfile).toContain('/repo/apps/bot/package.json ./package.json');
    });
});

describe('the web image', () => {
    /**
     * These pin the things that fail only at deploy: a manifest missing from the build
     * context, an environment nobody loads, a static directory the trace does not know
     * about. None of them fails a test run, a typecheck or a lint.
     */
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
    const read = (...p: string[]) => readFileSync(path.join(repoRoot, ...p), 'utf8');

    it('copies a manifest for every workspace apps/web depends on', () => {
        const dockerfile = read('Dockerfile.web');
        const declared = Object.keys(JSON.parse(read('apps', 'web', 'package.json')).dependencies ?? {})
            .filter((d) => d.startsWith('@nexusmods/'));
        expect(declared.length).toBeGreaterThan(3);

        // Package name to directory, since @nexusmods/discord-web lives in apps/web.
        const dirs = readdirSync(path.join(repoRoot, 'packages'))
            .filter((e) => existsSync(path.join(repoRoot, 'packages', e, 'package.json')));
        const dirOf = new Map(dirs.map((d) => [JSON.parse(read('packages', d, 'package.json')).name, d]));

        const missing = declared
            .map((dep) => dirOf.get(dep))
            .filter((dir): dir is string => Boolean(dir))
            .filter((dir) => !dockerfile.includes(`COPY packages/${dir}/package.json`));

        // npm resolves the tree from the manifests before any source is copied, so a
        // manifest missing here fails the install rather than the build, naming a
        // workspace that is right there in the repository.
        expect(missing, 'declared by apps/web but not COPYd into the build context').toEqual([]);
    });

    it('builds standalone, and copies what standalone does not trace', () => {
        // The config and the Dockerfile are two halves of one decision. Without the
        // config there is no .next/standalone for the COPY to find; without the COPY the
        // trace is built and thrown away.
        expect(read('apps', 'web', 'next.config.ts')).toMatch(/output:\s*'standalone'/);

        const dockerfile = read('Dockerfile.web');
        expect(dockerfile).toContain('/repo/apps/web/.next/standalone ./');
        // Neither of these is in the module graph - they are read from disk - so the
        // trace leaves them out and the site comes up with no CSS and no images.
        expect(dockerfile).toContain('/repo/apps/web/.next/static ./apps/web/.next/static');
        expect(dockerfile).toContain('/repo/apps/web/public ./apps/web/public');
    });

    /**
     * A standalone build does not evaluate next.config.ts - it runs a serialised copy of
     * the resolved config - so without this nothing loads .env in the container.
     */
    it('loads the environment somewhere the standalone server will run it', () => {
        expect(read('apps', 'web', 'instrumentation.ts')).toMatch(/@nexusmods\/core\/env\.js/);
    });

    it('runs the standalone server as PID 1', () => {
        const dockerfile = read('Dockerfile.web');
        // Exec form, for the same reason as the bot's: the shell form puts /bin/sh at PID
        // 1, which swallows SIGTERM and makes `docker stop` wait out its timeout.
        expect(dockerfile).toContain('CMD ["node", "server.js"]');
        // server.js resolves its own paths relative to itself, so it is run from where the
        // standalone output puts it rather than from /app.
        expect(dockerfile).toContain('WORKDIR /app/apps/web');
    });

    it('has CI build both images, and publish the web one under its own name', () => {
        const ci = read('.github', 'workflows', 'ci.yaml');
        expect(ci).toMatch(/file: Dockerfile$/m);
        expect(ci).toContain('file: Dockerfile.web');
        expect(ci).toContain('nexusmods/discord-bot-web:${{ github.sha }}');
        // Built on a pull request, pushed only on a push. The web Dockerfile is new, and
        // its first build should not be on master with the deploy webhook behind it.
        expect(ci).toContain("push: ${{ github.event_name == 'push' }}");
    });
});
