/**
 * Runs once before the server serves anything - Next's equivalent of the check Express
 * made in its constructor.
 *
 * The work is dynamically imported inside the runtime guard: Next analyses this file for
 * both runtimes, and a static import of node:crypto, pino or process.exit makes the Edge
 * build warn about code it will never run.
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    /**
     * next.config.ts imports this too, and that is not enough: a standalone build never
     * evaluates that file, so in the container nothing else would load .env.
     *
     * Early enough because every reader here reads process.env when called, not at import.
     * A test pins that no module reads a secret at import time.
     */
    await import('@nexusmods/core/env.js');

    const { runBootCheck } = await import('@/lib/bootCheck');
    runBootCheck();
}
