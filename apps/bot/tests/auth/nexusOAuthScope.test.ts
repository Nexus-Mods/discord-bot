import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOAuthUrl } from '@nexusmods/auth/NexusModsOAuth.js';

/**
 * Which OAuth scope the Nexus Mods authorize URL asks for.
 *
 * This had no test, and it cost a debugging session. The production application on the
 * Nexus Mods end has the `email` scope and the newer one used for development does not,
 * so the choice was written as `NODE_ENV === 'testing'` - the value this repository's .env
 * sets, and the one the bot's shard count and TLS defaults key off.
 *
 * Next sets its own NODE_ENV regardless of .env: 'development' under `next dev`,
 * 'production' for a build. So the moment the link flow moved to Next, that comparison
 * stopped matching and the site asked for a scope its application did not have - and it
 * fails at Nexus Mods, part-way through a link, nowhere near this line.
 *
 * Asking "is this production?" is one condition that holds for all four runtimes, and
 * these are the four.
 */
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;

const scopeFor = (nodeEnv: string | undefined): string | null => {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    const { url } = getOAuthUrl('a-state', logger);
    return new URL(url).searchParams.get('scope');
};

const DEV = 'public openid profile';
const PROD = 'openid email profile';

let original: string | undefined;

beforeEach(() => {
    original = process.env.NODE_ENV;
    process.env.NEXUS_OAUTH_ID = 'test-client';
    process.env.NEXUS_REDIRECT_URI = 'http://localhost:3000/nexus-mods-callback';
});

afterEach(() => {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
});

describe('the Nexus Mods OAuth scope', () => {
    it('asks for email only in production', () => {
        expect(scopeFor('production')).toBe(PROD);
    });

    /**
     * Typed explicitly. Inferred, the mixed tuples give `it.each` a union of two shapes and
     * tsc rejects the callback - which vitest itself never notices, because it transpiles
     * without typechecking and these all passed while `npm run typecheck` did not.
     */
    const NOT_PRODUCTION: Array<[string | undefined, string]> = [
        ['testing', "the bot and Express, from this repository's .env"],
        ['development', '`next dev`, which sets this itself'],
        ['test', 'vitest, which also sets it itself'],
        [undefined, 'nothing set at all'],
    ];

    it.each(NOT_PRODUCTION)('asks for the development scope when NODE_ENV is %s - %s', (nodeEnv) => {
        expect(scopeFor(nodeEnv)).toBe(DEV);
    });

    /**
     * The regression itself, stated as a rule: Express and the Next site are two runtimes
     * with different NODE_ENV values and the same OAuth application, so they have to ask
     * for the same thing. While both exist, this is what keeps them comparable.
     */
    it('gives Express and the Next dev server the same scope', () => {
        expect(scopeFor('testing')).toBe(scopeFor('development'));
    });

    it('still returns the error page rather than a URL when unconfigured', () => {
        delete process.env.NEXUS_OAUTH_ID;
        expect(getOAuthUrl('a-state', logger).url).toBe('/oauth-error');
    });
});
