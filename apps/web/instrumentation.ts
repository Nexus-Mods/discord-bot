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

    const { runBootCheck } = await import('@/lib/bootCheck');
    runBootCheck();
}
