import { manageableGuilds } from '@/lib/auth/guilds';
import type { ManageableGuild } from '@/lib/auth/guilds';
import { botInviteUrl } from '@/lib/invite';

/**
 * The server selector, in the shape Discord users already know: a column of icons, each
 * revealing its name on hover.
 *
 * No JavaScript. The reveal is `group-hover` and `group-focus-within`, so it works for a
 * keyboard as well as a mouse - and because a tooltip nobody can read is not a label, the
 * name is also on the link as `aria-label`. The tooltip itself is `aria-hidden`, or a
 * screen reader would announce the name twice.
 */

/** Discord's fallback for a server with no icon: the initials. */
export function acronym(name: string): string {
    return name.split(/\s+/).filter(Boolean).map((word) => [...word][0]).slice(0, 3).join('');
}

const TILE = [
    'flex size-12 items-center justify-center overflow-hidden bg-neutral-800',
    'text-title-sm text-neutral-50',
    // Discord's circle-to-squircle morph. Also the focus affordance, so a keyboard sees
    // the same feedback a mouse does.
    'rounded-full transition-[border-radius,background-color] duration-150',
    'hover:rounded-2xl hover:bg-primary-strong focus-visible:rounded-2xl',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-subdued',
].join(' ');

const TOOLTIP = [
    'pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2',
    'whitespace-nowrap rounded bg-neutral-950 px-2 py-1 text-body-sm text-neutral-50 shadow-lg',
    'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
].join(' ');

function RailItem({ guild, active }: { guild: ManageableGuild; active: boolean }) {
    return (
        <li className="group relative flex items-center">
            {/* Discord's active pill, flush against the rail's left edge. */}
            <span
                aria-hidden
                className={`absolute -left-3 h-5 w-1 rounded-r bg-neutral-50 transition-all ${
                    active ? 'h-10 opacity-100' : 'opacity-0 group-hover:opacity-60'
                }`}
            />
            <a href={`/manage/${guild.id}`} aria-label={guild.name} className={TILE}>
                {guild.iconUrl
                    ? <img
                        src={guild.iconUrl}
                        alt=""
                        width={48}
                        height={48}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                    />
                    : <span aria-hidden>{acronym(guild.name)}</span>}
            </a>
            <span role="tooltip" aria-hidden className={TOOLTIP}>{guild.name}</span>
        </li>
    );
}

function AddServer() {
    return (
        <li className="group relative flex items-center">
            <a
                href={botInviteUrl()}
                target="_blank"
                rel="noreferrer"
                aria-label="Add the bot to another server"
                className={`${TILE} border border-dashed border-neutral-600 bg-transparent hover:border-transparent`}
            >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </a>
            <span role="tooltip" aria-hidden className={TOOLTIP}>Add to another server</span>
        </li>
    );
}

/**
 * `activeId` is unset for now: this layout sits above `/manage/[guildId]`, and a layout
 * only receives params from the root down to itself - not from the segments below it.
 * When guild pages land, the pathname can come from a header set in proxy.ts, which keeps
 * the rail a server component rather than adding a client one for a highlight.
 */
const RAIL = 'flex-none bg-neutral-800 px-3 py-4';

/**
 * Async on purpose: it reads its own list rather than taking one as a prop, so the
 * Suspense boundary around it in the manage layout has something to suspend ON. Taking
 * the guilds as a prop would move the await up into the layout, where it blocks the whole
 * page - the shell, the header, the content - on a round trip to Discord.
 *
 * React's cache means the page below still shares this one fetch.
 */
export async function ServerRail({ activeId }: { activeId?: string }) {
    const { guilds } = await manageableGuilds();

    return (
        <nav aria-label="Your servers" className={RAIL}>
            <ul className="flex flex-col items-center gap-3">
                {guilds.map((g) => <RailItem key={g.id} guild={g} active={g.id === activeId} />)}
                {guilds.length > 0 && <li aria-hidden className="my-1 h-px w-8 bg-neutral-700" />}
                <AddServer />
            </ul>
        </nav>
    );
}

/**
 * What stands in while the rail is still waiting on Discord.
 *
 * The same width and rhythm as the real thing, so the content beside it does not jump
 * sideways when the tiles arrive. Three placeholders is a guess at a typical rail; the
 * count moving is far less jarring than the column moving.
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
