import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '@nexusmods/core/logger.js';

const requestMock = vi.fn();
vi.mock('graphql-request', async (importOriginal) => {
    const actual = await importOriginal<typeof import('graphql-request')>();
    return { ...actual, request: (...args: unknown[]) => requestMock(...args) };
});

const { mods } = await import('@nexusmods/nexus-api/queries/v2-modsbymodid.js');

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger;
const idsFor = (n: number) => Array.from({ length: n }, (_, i) => ({ gameDomain: 'skyrim', modId: i + 1 }));

describe('modsById pagination', () => {
    beforeEach(() => {
        requestMock.mockReset();
        // Echo back one node per requested id, so the result count reflects paging.
        requestMock.mockImplementation((_url, _query, vars: { mods: unknown[] }) => Promise.resolve({
            legacyModsByDomain: { nodes: (vars.mods ?? []).map((m, i) => ({ ...(m as object), uid: String(i) })) },
        }));
    });

    it('returns every mod when there are more than one page of them', async () => {
        // The bug: ids.slice(length, 50) instead of ids.slice(length, length + 50).
        // Page two onward was always an empty slice, so mods past the first 50 were
        // silently dropped.
        const result = await mods({}, logger, idsFor(120));
        expect(result).toHaveLength(120);
    });

    it('splits into pages of at most 50', async () => {
        await mods({}, logger, idsFor(120));
        const pageSizes = requestMock.mock.calls.map((call) => (call[2] as { mods: unknown[] }).mods.length);
        expect(pageSizes).toEqual([50, 50, 20]);
    });

    it('sends a single page when the request fits', async () => {
        const result = await mods({}, logger, idsFor(10));
        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(10);
    });

    it('accepts a single mod as well as an array', async () => {
        const result = await mods({}, logger, { gameDomain: 'skyrim', modId: 1 });
        expect(result).toHaveLength(1);
    });

    it('makes no request at all for an empty list', async () => {
        await expect(mods({}, logger, [])).resolves.toEqual([]);
        expect(requestMock).not.toHaveBeenCalled();
    });
});
