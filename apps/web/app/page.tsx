/**
 * Deliberately the only route.
 *
 * Step 4 of the Phase 4 plan is a scaffold, not a port: its job is to prove the app
 * builds inside the workspace, that the root lint config reaches it, and that CI stays
 * green - with nothing ported, so a failure here has exactly one possible cause. The
 * eight Express views arrive in step 6, after the packages are cut.
 *
 * It renders the theme because that is the one thing worth eyeballing now. If the type
 * scale or the brand colour is wrong it is far cheaper to see it on an empty page than
 * after eight views have been built on top of it.
 */
const COLOURS = [
    { token: 'primary-400', className: 'bg-primary-400', note: 'brand — Tailwind orange-400' },
    { token: 'primary-strong', className: 'bg-primary-strong', note: 'orange-300' },
    { token: 'creator-strong', className: 'bg-creator-strong', note: 'teal-400' },
    { token: 'premium-strong', className: 'bg-premium-strong', note: 'violet-300' },
    { token: 'info-moderate', className: 'bg-info-moderate', note: 'blue-400' },
    { token: 'success-moderate', className: 'bg-success-moderate', note: 'green-500' },
    { token: 'warning-strong', className: 'bg-warning-strong', note: 'yellow-200' },
    { token: 'danger-strong', className: 'bg-danger-strong', note: 'red-400' },
];

const TYPE = [
    { token: 'text-heading-lg', className: 'text-heading-lg' },
    { token: 'text-heading-sm', className: 'text-heading-sm' },
    { token: 'text-body-lg', className: 'text-body-lg' },
    { token: 'text-body-md', className: 'text-body-md' },
    { token: 'text-title-sm', className: 'text-title-sm uppercase' },
];

export default function Home() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-16">
            <p className="text-title-sm uppercase text-primary-400">Phase 4 · step 4 · scaffold</p>
            <h1 className="mt-4 text-heading-lg text-balance">Nexus Mods Discord Bot</h1>
            <p className="mt-4 max-w-[62ch] text-body-lg text-neutral-400">
                The Next.js app builds and the theme resolves. Nothing is ported yet — Express
                still serves all eight views in production.
            </p>

            <h2 className="mt-14 text-title-sm uppercase text-neutral-400">Colour</h2>
            <ul className="mt-4 grid gap-px overflow-hidden rounded border border-neutral-800 bg-neutral-800 sm:grid-cols-2">
                {COLOURS.map((c) => (
                    <li key={c.token} className="flex items-center gap-4 bg-neutral-900 p-4">
                        <span className={`${c.className} size-10 flex-none rounded-sm`} aria-hidden="true" />
                        <span className="min-w-0">
                            <span className="block font-mono text-body-md">{c.token}</span>
                            <span className="block truncate text-body-sm text-neutral-400">{c.note}</span>
                        </span>
                    </li>
                ))}
            </ul>

            <h2 className="mt-14 text-title-sm uppercase text-neutral-400">Type scale</h2>
            <ul className="mt-4 divide-y divide-neutral-800 rounded border border-neutral-800">
                {TYPE.map((t) => (
                    <li key={t.token} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 bg-neutral-900 p-4">
                        <span className={`${t.className} text-neutral-200`}>Modding made easy</span>
                        <span className="font-mono text-body-sm text-neutral-500">{t.token}</span>
                    </li>
                ))}
            </ul>
        </main>
    );
}
