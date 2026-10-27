import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ReadOnlyNotice, Text } from '@/components/ui';
import { guildAccess } from '@/lib/auth/guilds';
import { GuildUnavailable } from '@/components/GuildUnavailable';
import { timeAgo, trackingFor } from '@/lib/tracking';
import Link from 'next/link';

/**
 * Everything this server has the bot watching. View only for now.
 *
 * A component rather than a page, because two routes render it: /manage/<id> shows it
 * when no tab is named, and /manage/<id>/tracked is the addressable form. One copy, so
 * the two cannot drift.
 */

const COLUMNS = ['Item Name', 'Channel', 'Last update', 'ID'];

export async function TrackedPanel({ guildId }: { guildId: string }) {
    // timeAgo reads the clock, so prerendering has to stop here.
    await connection();

    // The layout checked access too. Repeated on purpose: a view that trusts its layout
    // for authorisation stops being safe the moment someone renders it somewhere else.
    const { guild, unavailable } = await guildAccess(guildId);
    // A rate limit is not a permission denial.
    if (unavailable) return <GuildUnavailable />;
    if (!guild) notFound();

    const tracking = await trackingFor(guildId);
    const subs = tracking?.subs ?? [];

    return (
        <>
            {!guild.canManageFeeds && (
                <ReadOnlyNotice>
                    You can see what this server tracks, but not change it. Adding and
                    removing tracked items needs the <strong>Manage Channels</strong>{' '}
                    permission in this Discord server.
                </ReadOnlyNotice>
            )}

            {subs.length === 0 ? (
                <Text>
                    Nothing is tracked in this server yet. Tracking is set up with the{' '}
                    <code className="font-mono">/track</code> command in Discord.
                </Text>
            ) : (
                <div className="my-6 overflow-x-auto rounded border border-neutral-700">
                    <table className="w-full border-collapse text-body-md">
                        <thead>
                            <tr className="bg-neutral-800 text-left text-title-sm uppercase text-info-moderate">
                                {COLUMNS.map((c) => <th key={c} scope="col" className="whitespace-nowrap p-3">{c}</th>)}
                                <th scope="col" className="p-3 text-right"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {subs.map((sub) => (
                                <tr key={sub.id} className="border-t border-neutral-700 bg-neutral-800/60">
                                    <td className="p-3">
                                        <div>{sub.title}</div>
                                        <div className='text-body-sm text-neutral-600 font-mono'>
                                            {String(sub.type).toUpperCase()} - {sub.entityid}
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap p-3">#{sub.channelName}</td>
                                    <td className="whitespace-nowrap p-3" title={sub.last_update.toISOString()}>
                                        {timeAgo(sub.last_update)}
                                    </td>
                                    <td className="p-3">{sub.id}</td>
                                    <td className="p-3 text-right">
                                        {/* A link, not a disabled button: the page it opens
                                            shows the options and cannot save them yet, which
                                            is worth seeing either way. */}
                                        <Link
                                            href={`/manage/${guildId}/tracked/${sub.id}`}
                                            className="inline-block rounded border border-neutral-600 px-3 py-1 text-body-sm text-neutral-50 transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-subdued"
                                        >
                                            {guild.canManageFeeds ? 'Edit' : 'View'}
                                            <span className="sr-only"> {sub.title}</span>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Text>
                {subs.length > 0 && `${subs.length} tracked ${subs.length === 1 ? 'item' : 'items'}. `}
                Changing them from here is coming; for now use{' '}
                <code className="font-mono">/track</code> and{' '}
                <code className="font-mono">/untrack</code> in Discord.
            </Text>
        </>
    );
}
