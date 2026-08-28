import { defineConfig } from 'vitest/config';

export default defineConfig({
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
