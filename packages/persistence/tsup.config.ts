import { defineConfig } from 'tsup';

/**
 * The same transpile-only build the bot uses, for the same reason: one output file per
 * source file, so a subpath export maps onto a real file and stack traces point at
 * something that exists. Bundling a library whose whole purpose is to be imported four
 * modules at a time would inline all of it into each entry.
 */
export default defineConfig({
    entry: ['src/**/*.ts'],
    outDir: 'dist',
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    bundle: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: false,
});
