/**
 * Load the repository's root .env first: Next reads .env from its own project directory,
 * so nothing at the root reaches this process otherwise. Side-effect import, before
 * anything that reads process.env.
 */
import '@nexusmods/core/env.js';
import type { NextConfig } from 'next';

const config: NextConfig = {
    /**
     * Traces only the modules the server loads into .next/standalone, so the web image does
     * not carry the whole workspace's node_modules.
     *
     * NOTE: the standalone server does NOT evaluate this file - it runs a serialised copy
     * of the resolved config - so the env import above never runs in production.
     * instrumentation.ts loads it there.
     */
    output: 'standalone',

    // Next's default, stated so that turning it off is a decision.
    typescript: { ignoreBuildErrors: false },
};

export default config;
