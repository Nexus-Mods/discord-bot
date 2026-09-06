import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * apps/web had no test runner until step 7, which was fine while it was eight pages of
 * markup and stopped being fine the moment it started holding rate limits and a cookie
 * signature.
 *
 * The aliases mirror tsconfig's `paths` and the bot's package alias, for the same reason
 * given there: the packages' exports map answers the runtime condition with dist/, so
 * without this a test run would silently depend on a build having happened first.
 */
export default defineConfig({
    resolve: {
        alias: [
            { find: /^@nexusmods\/([^/]+)\/(.*)\.js$/, replacement: path.join(here, '..', '..', 'packages', '$1', 'src', '$2.ts') },
            { find: /^@\/(.*)$/, replacement: path.join(here, '$1') },
        ],
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        env: { NODE_ENV: 'test' },
    },
});
