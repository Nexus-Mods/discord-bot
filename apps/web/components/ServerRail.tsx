import { manageableGuilds } from '@/lib/auth/guilds';
import { RailLinks } from '@/components/RailLinks';

/**
 * The server selector, in the shape Discord users already know.
 *
 * Async on purpose: it reads its own list rather than taking one as a prop, so the
 * Suspense boundary around it in the manage layout has something to suspend on. Taking
 * the guilds as a prop would move the await up into the layout, where it blocks the
 * whole page on a round trip to Discord.
 *
 * The markup lives in RailLinks, which is a client component so that switching server is
 * a client navigation rather than a full page load.
 */

const RAIL = 'flex-none bg-neutral-800 px-3 py-4';

export async function ServerRail() {
    const { guilds } = await manageableGuilds();

    return (
        <nav aria-label="Your servers" className={RAIL}>
            <RailLinks guilds={guilds} />
        </nav>
    );
}

/**
 * What stands in while the rail is still waiting on Discord.
 *
 * The same width and rhythm as the real thing, so the content beside it does not jump
 * sideways when the tiles arrive.
 */
export function ServerRailSkeleton() {
    return (
        <div aria-hidden className={RAIL}>
            <ul className="flex animate-pulse flex-col items-center gap-3">
                {[0, 1, 2].map((i) => <li key={i} className="size-12 rounded-full bg-neutral-700" />)}
                <li className="my-1 h-px w-8 bg-neutral-700" />
                <li className="size-12 rounded-full border border-dashed border-neutral-600" />
            </ul>
        </div>
    );
}
