import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every path Express serves has something serving it here. Reads the route table out of
 * server.ts rather than listing paths, so it notices when the two disagree.
 *
 * The gate on deleting Express - and this file goes with it when that happens.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(here, '..', 'app');
const SERVER = path.join(here, '..', '..', 'bot', 'src', 'server', 'server.ts');

/** `this.app.get('/thing', ...)` and friends, minus the middleware registrations. */
function expressRoutes(): { method: string; path: string }[] {
    const source = readFileSync(SERVER, 'utf8');
    const found: { method: string; path: string }[] = [];
    const pattern = /this\.app\.(get|post|put|delete|patch|all)\(\s*'([^']+)'/g;
    for (const m of source.matchAll(pattern)) {
        found.push({ method: m[1].toUpperCase(), path: m[2] });
    }
    return found;
}

/** What answers `pathname` in the Next app: a page, a route handler, or nothing. */
function nextHandlerFor(pathname: string): { kind: 'page' | 'route'; file: string } | null {
    const segment = pathname === '/' ? '' : pathname.slice(1);
    for (const [kind, file] of [['route', 'route.ts'], ['page', 'page.tsx']] as const) {
        const candidate = path.join(APP, segment, file);
        if (existsSync(candidate)) return { kind, file: candidate };
    }
    return null;
}

describe('the Next app against the Express route table', () => {
    it('finds the Express routes at all', () => {
        // A guard on the parser: if server.ts is reformatted and this stops matching, every
        // assertion below passes vacuously.
        const routes = expressRoutes();
        expect(routes.length).toBeGreaterThanOrEqual(16);
        expect(routes.map((r) => r.path)).toContain('/nexus-mods-callback');
    });

    it('serves every path Express serves', () => {
        const missing = expressRoutes()
            .filter(({ path: p }) => !nextHandlerFor(p))
            .map(({ method, path: p }) => `${method} ${p}`);

        expect(missing, 'Express serves these and apps/web does not').toEqual([]);
    });

    /**
     * A Next segment holds either a page or a route handler, never both, so /revoke's POST
     * is a server action. Without this the check above passes on the page alone.
     */
    it('has a submit for POST /revoke, which Next cannot serve as a route handler', () => {
        const post = expressRoutes().find((r) => r.method === 'POST' && r.path === '/revoke');
        expect(post, 'Express no longer has POST /revoke - this test is out of date').toBeTruthy();

        const actions = path.join(APP, 'revoke', 'actions.ts');
        expect(existsSync(actions)).toBe(true);
        const source = readFileSync(actions, 'utf8');
        expect(source).toMatch(/^'use server';/);
        expect(source).toContain('export async function revokeAccountLink');

        const page = readFileSync(path.join(APP, 'revoke', 'page.tsx'), 'utf8');
        // Wired to the action, not a URL: `action="/revoke"` would post to the page.
        expect(page).toContain('<form action={revokeAccountLink}>');
    });

    /**
     * The two ends of the success redirect. Express reads `d_id`/`n_id` and renders them as
     * template variables named `discordId`/`nexusId`, and the page falls back to a plain
     * name when an id is missing - so a mismatch loses the links without breaking anything.
     */
    it('sends the success page the query parameters it reads', () => {
        const page = readFileSync(path.join(APP, 'success', 'page.tsx'), 'utf8');
        const read = new Set([...page.matchAll(/\bparams\.([A-Za-z_][\w]*)/g)].map((m) => m[1]));
        expect(read.size).toBeGreaterThan(0);

        const account = readFileSync(path.join(here, '..', 'lib', 'link', 'account.ts'), 'utf8');
        const shape = account.slice(account.indexOf('export interface LinkResult'));
        const sent = new Set(
            [...shape.slice(0, shape.indexOf('}')).matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]),
        );
        expect(sent.size).toBeGreaterThan(0);

        const unsent = [...read].filter((name) => !sent.has(name));
        expect(unsent, 'the success page reads query parameters the redirect does not send').toEqual([]);
    });
});
