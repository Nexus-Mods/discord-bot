import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards against new runtime import cycles.
 *
 * A cycle is legal in ESM and usually works, which is why this codebase accumulated them
 * unnoticed. The failure mode when one does bite is nasty: a module in a cycle sees
 * `undefined` for its partner's bindings during initialisation, so it depends on load
 * order - and this bot loads every interaction module by `readdir` and dynamic `import()`,
 * so load order is a function of filenames on disk.
 *
 * This counts only edges that survive compilation. `import type` clauses and specifiers
 * marked `type` are erased by TypeScript, so they cannot cause a runtime cycle; the
 * consistent-type-imports lint rule is what makes them reliably identifiable here. The
 * count this produces was checked against the emitted JavaScript in dist/ and matches.
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

const CLAUSE = /^\s*import\s+(type\s+)?(?:(\{[^}]*\})|([^'";]+?))?\s*(?:from\s*)?['"](\.[^'"]+)['"]/gm;

function runtimeGraph(files: string[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const f of files) {
        const src = readFileSync(f, 'utf8');
        const deps: string[] = [];
        for (const m of src.matchAll(CLAUSE)) {
            const typeKeyword = m[1];
            const braces = m[2];
            const spec = m[4];
            if (typeKeyword) continue;
            if (braces) {
                const names = braces.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
                if (names.length === 0) continue;
                if (names.every((n) => /^type\s/.test(n))) continue;
            }
            const resolved = path.normalize(path.join(path.dirname(f), spec.replace(/\.js$/, '.ts')));
            if (files.includes(resolved)) deps.push(resolved);
        }
        graph.set(f, deps);
    }
    return graph;
}

function findCycles(graph: Map<string, string[]>): string[] {
    const cycles = new Set<string>();
    const stack: string[] = [];
    const onStack = new Set<string>();
    const seen = new Set<string>();
    function dfs(n: string) {
        if (onStack.has(n)) {
            cycles.add(stack.slice(stack.indexOf(n)).concat(n).join(' -> '));
            return;
        }
        if (seen.has(n)) return;
        seen.add(n); onStack.add(n); stack.push(n);
        for (const d of graph.get(n) ?? []) dfs(d);
        stack.pop(); onStack.delete(n);
    }
    for (const f of graph.keys()) { seen.clear(); dfs(f); }
    return [...cycles].sort();
}

/**
 * The one cycle that is still here: SubscribedChannel and SubscribedItem are
 * active-record classes whose methods call the persistence layer, while the persistence
 * layer constructs them. Breaking it means separating the model from its storage across
 * a 730-line file and ten construction sites, which is its own change - see
 * MODERNISATION.md 3.6. It is benign today because neither module touches the other at
 * module scope, only inside methods.
 */
const KNOWN = [
    'api/subscriptions -> types/subscriptions -> api/subscriptions',
    'types/subscriptions -> api/subscriptions -> types/subscriptions',
];

describe('runtime import cycles', () => {
    const cycles = findCycles(runtimeGraph(sourceFiles()))
        .map((c) => c.replace(/src[\\/]/g, '').replace(/\.ts/g, '').replace(/\\/g, '/'));

    it('has no cycles beyond the one known exception', () => {
        expect(cycles).toEqual(KNOWN);
    });

    // If someone fixes the subscriptions split, this fails and the list above should be
    // emptied - a deliberate nudge rather than a silently passing stale allow-list.
    it('still has the known exception, so the allow-list is not stale', () => {
        expect(cycles.length).toBe(KNOWN.length);
    });
});
