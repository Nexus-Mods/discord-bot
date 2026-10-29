'use client';

import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import type { ManageableGuild } from '@/lib/auth/guilds';
import { acronym } from '@/lib/acronym';

/**
 * The tiles in the server rail.
 *
 * A client component for the same reason the tabs are: switching server was a full page
 * load, which rebuilt the rail, re-asked Discord, and flashed the unscoped /manage
 * skeleton on the way past. next/link makes it a client navigation, so the rail stays put
 * and only the panel changes.
 *
 * The active pill used to come from the x-pathname header, read in the manage layout -
 * which a client navigation does not re-render, so it would have frozen on whichever
 * server was open when the page loaded. useSelectedLayoutSegments gives the live one:
 * from the manage layout, /manage/123/tracked reads as ['123', 'tracked'].
 *
 * The data still arrives as props from a server component. Nothing here fetches.
 */

const TILE = [
    'flex size-12 items-center justify-center overflow-hidden bg-neutral-800',
    'text-title-sm text-neutral-50',
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
            <span
                aria-hidden
                className={`absolute -left-3 w-1 rounded-r bg-neutral-50 transition-all ${
                    active ? 'h-10 opacity-100' : 'h-5 opacity-0 group-hover:opacity-60'
                }`}
            />
            <Link
                href={`/manage/${guild.id}`}
                // Off: a rail of N servers would otherwise render N guild pages the moment
                // it appears, each asking Discord for the same guild list. The tabs keep
                // theirs, because two routes per guild is what makes a tab swap instant.
                prefetch={false}
                aria-label={guild.name}
                aria-current={active ? 'page' : undefined}
                className={TILE}
            >
                {guild.iconUrl
                    ? (
                        <img
                            src={guild.iconUrl}
                            alt=""
                            width={48}
                            height={48}
                            loading="lazy"
                            decoding="async"
                            className="size-full object-cover"
                        />
                    )
                    : <span aria-hidden>{acronym(guild.name)}</span>}
            </Link>
            <span role="tooltip" aria-hidden className={TOOLTIP}>{guild.name}</span>
        </li>
    );
}

function AddServer({ inviteUrl }: { inviteUrl: string }) {
    return (
        <li className="group relative flex items-center">
            {/* A plain anchor: this one leaves the site. */}
            <a
                href={inviteUrl}
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
 * `inviteUrl` arrives as a prop rather than being built here. botInviteUrl() reads
 * process.env.DISCORD_CLIENT_ID, and Next only exposes NEXT_PUBLIC_* variables to the
 * browser - so the server rendered the real URL and the client rendered one with an empty
 * client_id, which is the hydration mismatch. useMemo does not help: it still runs in the
 * browser, it just memoises the wrong answer.
 */
export function RailLinks({ guilds, inviteUrl }: { guilds: ManageableGuild[]; inviteUrl: string }) {
    const [activeId] = useSelectedLayoutSegments();

    return (
        <ul className="flex flex-col items-center gap-3">
            {guilds.map((g) => <RailItem key={g.id} guild={g} active={g.id === activeId} />)}
            {guilds.length > 0 && <li aria-hidden className="my-1 h-px w-8 bg-neutral-700" />}
            <AddServer inviteUrl={inviteUrl} />
        </ul>
    );
}
