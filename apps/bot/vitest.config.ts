import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            {
                /**
                 * Resolve the workspace packages to their source rather than their dist/.
                 *
                 * Their exports map answers the runtime condition with dist/, so without
                 * this `npm test` silently depends on `npm run build` having happened -
                 * and a package that has never been built fails with "Cannot find
                 * package", which points at resolution rather than at a missing build.
                 *
                 * Source is also what the typechecker and the linter read, so all three
                 * are now looking at the same files. What dist/ actually contains is
                 * checked where it matters: the Docker build assembles the runtime image
                 * and imports from it.
                 */
                find: /^@nexusmods\/([^/]+)\/(.*)\.js$/,
                replacement: path.join(here, '..', '..', 'packages', '$1', 'src', '$2.ts'),
            },
        ],
    },
    test: {
        environment: 'node',
        // Tests live outside src/ so tsup's `src/**/*.ts` entry glob does not
        // compile them into dist/.
        include: ['tests/**/*.test.ts'],
        // Keeps pino on its synchronous path and off a pino-pretty worker thread.
        env: { NODE_ENV: 'test' },
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            reporter: ['text-summary', 'lcov'],
        },
    },
});
