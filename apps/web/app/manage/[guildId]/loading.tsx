/**
 * The skeleton for a guild's panel.
 *
 * This is what makes a tab swap feel instant: Next commits the navigation as soon as it
 * has a boundary to show, so the tab underline moves and this appears straight away while
 * the panel streams in behind it. Without it the old panel sits there, apparently
 * unresponsive, until the new one is ready.
 *
 * It replaces app/manage/loading.tsx, which was the wrong shape for a guild route - a
 * full-page "Manage your servers" skeleton flashing past on the way to a server.
 */
export default function Loading() {
    return (
        <div aria-busy="true" className="my-6 animate-pulse space-y-3">
            <div className="h-10 w-full rounded bg-neutral-800" />
            <div className="h-10 w-5/6 rounded bg-neutral-800" />
            <div className="h-10 w-2/3 rounded bg-neutral-800" />
        </div>
    );
}
