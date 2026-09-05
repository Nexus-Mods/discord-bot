import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '@nexusmods/core/logger.js';

const requestMock = vi.fn();
vi.mock('graphql-request', async (importOriginal) => {
    const actual = await importOriginal<typeof import('graphql-request')>();
    return { ...actual, request: (...args: unknown[]) => requestMock(...args) };
});

const { news } = await import('@nexusmods/nexus-api/queries/v2-news.js');
const { users } = await import('@nexusmods/nexus-api/queries/v2-users.js');
const { modsByUid } = await import('@nexusmods/nexus-api/queries/v2-modsbyuid.js');
const { modFiles } = await import('@nexusmods/nexus-api/queries/v2-modsFiles.js');
const { mods } = await import('@nexusmods/nexus-api/queries/v2-modsbymodid.js');

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger;

// Braces matter. `() => requestMock.mockReset()` implicitly returns the mock, which
// vitest then awaits - and awaiting a mock function reads `.then` off it, invoking the
// throwing implementation left over from the previous test outside any try. That
// surfaced as every test failing with the raw error instead of the assertion running.
beforeEach(() => { requestMock.mockReset(); });

/**
 * The contract these modules used to break.
 *
 * Returning [] on failure made "there are none" and "the API is down" the same value.
 * For a command that meant a user was told there were no results when Nexus Mods was
 * unreachable. For a feed it was worse and quieter: a failed poll looked like a poll
 * that found nothing, the cycle was recorded as successful, and the window moved past
 * everything published during the outage - permanently, with nothing in the logs.
 */
/**
 * One entry per module, iterated with a plain loop rather than `it.each`: passing a
 * function inside an each-tuple made vitest report the mock's rejection as an unhandled
 * error before the assertion ever ran.
 */
const CALLS: { name: string; call: () => Promise<unknown> }[] = [
    { name: 'news', call: () => news({}, logger) },
    { name: 'users', call: () => users({}, logger, 'someone') },
    { name: 'modsByUid', call: () => modsByUid({}, logger, ['1']) },
    { name: 'modFiles', call: () => modFiles({}, logger, 100, 200) },
];

/**
 * Capture a rejection explicitly.
 *
 * `expect(p).rejects.toMatchObject(...)` misreported these as the raw underlying error
 * rather than what the module actually threw - confirmed by awaiting the same call by
 * hand in this file and seeing NexusApiError. Capturing the reason directly asserts on
 * the value that really came out.
 */
async function rejection(call: () => Promise<unknown>): Promise<any> {
    // The call itself is inside the try: a mock that throws synchronously would
    // otherwise escape before .then() could attach.
    try {
        await call();
    }
    catch (e) {
        return e;
    }
    throw new Error('expected a rejection, got a value');
}

describe('query modules propagate failure', () => {
    // Asserted on shape rather than `toThrow(NexusApiError)`: under vi.mock the module
    // under test and this file can resolve `errors.js` to different instances, so an
    // instanceof check fails even when the right error was thrown. `code` is the stable
    // discriminator the taxonomy was built around.
    for (const { name, call } of CALLS) {
        it(`${name} throws instead of returning []`, async () => {
            requestMock.mockImplementation(() => { throw new Error('gateway timeout'); });
            expect(await rejection(call)).toMatchObject({ name: 'NexusApiError', code: 'NEXUS_API' });
        });

        it(`${name} carries a user-facing message and the original cause`, async () => {
            requestMock.mockImplementation(() => { throw new Error('gateway timeout'); });
            expect(await rejection(call)).toMatchObject({
                userMessage: expect.stringContaining('Nexus Mods'),
                cause: expect.anything(),
            });
        });
    }
});

describe('a genuinely empty result is still empty', () => {
    // The other half of the contract: propagating errors must not turn "none" into a
    // failure, or every quiet poll becomes an alert.
    it('news returns [] when the API returns no articles', async () => {
        requestMock.mockResolvedValue({ news: { nodes: [] } });
        await expect(news({}, logger)).resolves.toEqual([]);
    });

    it('users returns [] when nobody matches', async () => {
        requestMock.mockResolvedValue({ users: { nodes: [] } });
        await expect(users({}, logger, 'nobody')).resolves.toEqual([]);
    });
});

describe('modsById does not return partial pages', () => {
    const idsFor = (n: number) => Array.from({ length: n }, (_, i) => ({ gameDomain: 'skyrim', modId: i + 1 }));

    it('throws when a later page fails, rather than returning the earlier ones', async () => {
        let call = 0;
        requestMock.mockImplementation((_url, _q, vars: { mods: unknown[] }) => {
            call += 1;
            // First page succeeds, second fails - the shape that used to yield a short list.
            if (call === 1) {
                return Promise.resolve({ legacyModsByDomain: { nodes: (vars.mods ?? []).map((m, i) => ({ ...(m as object), uid: String(i) })) } });
            }
            throw new Error('gateway timeout');
        });

        expect(await rejection(() => mods({}, logger, idsFor(120)))).toMatchObject({ name: 'NexusApiError', code: 'NEXUS_API' });
    });

    it('reports how much it had before failing, for the logs', async () => {
        let call = 0;
        requestMock.mockImplementation((_url, _q, vars: { mods: unknown[] }) => {
            call += 1;
            if (call === 1) {
                return Promise.resolve({ legacyModsByDomain: { nodes: (vars.mods ?? []).map((m, i) => ({ ...(m as object), uid: String(i) })) } });
            }
            throw new Error('gateway timeout');
        });

        expect(await rejection(() => mods({}, logger, idsFor(120)))).toMatchObject({
            context: { requested: 120, retrieved: 50 },
        });
    });
});
