/**
 * The boot check, which is the seventh thing Express was carrying.
 *
 * `AuthSite.initialize` refuses to start when a required secret is missing and warns when
 * an optional one is, so a misconfiguration is a failed deploy rather than a 500 the first
 * time somebody links an account. Next has no constructor to put that in; `register()` is
 * the documented equivalent and runs once, before the server serves anything.
 *
 * The work is in lib/bootCheck.ts and reached by dynamic import inside the runtime guard.
 * Next compiles this file for both runtimes and analyses it statically, so a static import
 * of code that uses node:crypto, pino or process.exit makes the Edge build warn about
 * three things it is never going to run.
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    /**
     * The environment, before anything that needs it - including the boot check below.
     *
     * next.config.ts imports this too, and that is not enough. A standalone build does
     * not evaluate next.config.ts at runtime: it runs a serialised copy of the resolved
     * config, so the import there covers `next dev` and `next build` and nothing else.
     * Verified by building standalone and running it with the secrets only in a .env file
     * on disk - the boot check reported all three as missing and exited 1.
     *
     * That is the right failure and the wrong outcome: the deployment mounts .env into the
     * container the same way the bot's does, and the web container would have refused
     * every start. Loaded here, both containers get their configuration by one mechanism
     * from one file.
     *
     * register() runs once before the server accepts a request, which is early enough for
     * every reader in this app: they all read process.env when called, not when imported.
     * A module that read a secret at import time would need this earlier than Next offers
     * - there is a test that no such module appears.
     */
    await import('@nexusmods/core/env.js');

    const { runBootCheck } = await import('@/lib/bootCheck');
    runBootCheck();
}
