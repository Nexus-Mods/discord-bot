import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Content, PageTitle } from '@/components/ui';
import { one, type SearchParams } from '@/lib/search';
import { trackingFor } from '@/lib/tracking';

/**
 * Every subscription in one guild: two Discord REST calls and one query, all keyed on a
 * guild id anyone can put in the URL. That is deliberate and matches Express - the page
 * shows what every member of that server can already see, and there is no session here.
 *
 * `await connection()` because `timeAgo` reads the clock; prerendered, every "42 seconds
 * ago" would freeze at build time.
 */
export const metadata: Metadata = { title: 'Tracking Summary' };

/** The Express version's relative formatter, unchanged apart from taking the Date it is given. */
function timeAgo(when: Date): string {
    const seconds = Math.floor((Date.now() - when.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return `${seconds} seconds ago`;
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
}

const COLUMNS = ['ID', 'Type', 'Channel', 'Name', 'Entity ID', 'Last Update'];

export default async function Tracking({ searchParams }: { searchParams: SearchParams }) {
    await connection();

    // No guild, or one the bot cannot see, goes to the front page rather than an error.
    const guildId = one((await searchParams).guild);
    if (!guildId) redirect('/');

    const tracking = await trackingFor(guildId);
    if (!tracking) redirect('/');

    const { guild, guildImage, subs } = tracking;

    return (
        <Content>
            <PageTitle>Tracking Summary</PageTitle>

            <div className="my-4 flex items-center gap-3 rounded bg-[#5865F2] p-2 text-body-lg">
                {/* Nullable: a guild with no icon rendered src="null" and a broken image in
                    the EJS. */}
                {guildImage && <img src={guildImage} alt="" className="size-16 flex-none rounded-2xl" />}
                <span>Summary for <strong>{guild}</strong></span>
            </div>

            {/* The table is the one thing on these pages that can be wider than a phone.
                Scrolling it inside its own box beats scrolling the document sideways. */}
            <div className="overflow-x-auto rounded border border-neutral-700">
                <table className="w-full border-collapse text-body-md">
                    <thead>
                        <tr className="bg-neutral-800 text-left text-title-sm uppercase text-info-moderate">
                            {COLUMNS.map((c) => <th key={c} scope="col" className="whitespace-nowrap p-3">{c}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {subs.length === 0 ? (
                            <tr>
                                {/* colSpan is the number of columns. The EJS said 5 with six
                                    headers, so the empty state stopped short of the last one. */}
                                <td colSpan={COLUMNS.length} className="p-3 text-center italic text-neutral-400">
                                    No subscriptions
                                </td>
                            </tr>
                        ) : subs.map((sub) => (
                            <tr key={sub.id} className="border-t border-neutral-700 bg-neutral-800/60 hover:bg-neutral-700/60">
                                <td className="p-3">{sub.id}</td>
                                <td className="p-3">{String(sub.type).toUpperCase()}</td>
                                <td className="p-3 whitespace-nowrap">#{sub.channelName}</td>
                                <td className="p-3">{sub.title}</td>
                                <td className="p-3"><code className="font-mono text-body-sm">{sub.entityid}</code></td>
                                <td className="p-3 whitespace-nowrap" title={sub.last_update.toISOString()}>
                                    {timeAgo(sub.last_update)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Content>
    );
}
