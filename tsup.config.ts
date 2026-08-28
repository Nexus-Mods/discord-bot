import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/**/*.ts'],
    outDir: 'dist',
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    // DiscordBot.ts readdir()s dist/interactions and dist/events and imports each
    // file it finds. Bundling would collapse those into one module and break
    // command registration, so this is a transpile-only build.
    bundle: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: false,
    // Types are checked by `npm run typecheck`; esbuild only strips them.
    onSuccess: 'node scripts/copy-assets.mjs',
});
