import type { Metadata } from 'next';
import type { ISubscribedItem, SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';
import { Content, PageTitle } from '@/components/ui';

/**
 * Ported from trackingInfo.ejs: every subscription in one guild.
 *
 * The only one of the eight views that renders data, and the only one still holding a
 * fixture. The types are the real ones - `ISubscribedItem` straight out of
 * @nexusmods/persistence, which is the first time the web app has imported a package at
 * all - so the columns and the row shape are checked against the database's model even
 * though the rows are invented. Step 7 replaces FIXTURE with the query and nothing else
 * on this page has to move.
 *
 * Wiring it now would have meant giving the web app database credentials, a pool that
 * survives Next's dev reloads, and an error path for an unreachable Postgres, in the step
 * whose whole point is that a failure has one possible cause. It also cannot be done
 * without changing `getServer`, which takes a discord.js Guild and reads `.name` off it -
 * a web request has a guild id and no gateway object.
 */
export const metadata: Metadata = { title: 'Tracking Summary' };

type Row = Pick<ISubscribedItem<SubscribedItemType>, 'id' | 'type' | 'title' | 'entityid' | 'last_update'>
    & { channelName: string };

const FIXTURE: { guild: string; guildImage: string; subs: Row[] } = {
    guild: 'Nexus Mods',
    guildImage: 'https://cdn.discordapp.com/embed/avatars/0.png',
    subs: [
        { id: 1, type: 'game' as SubscribedItemType, title: 'Skyrim Special Edition', entityid: 1704, channelName: 'mod-feed', last_update: new Date(Date.now() - 42 * 1000) },
        { id: 2, type: 'mod' as SubscribedItemType, title: 'SkyUI', entityid: '7316058792508', channelName: 'mod-feed', last_update: new Date(Date.now() - 26 * 60 * 1000) },
        { id: 3, type: 'collection' as SubscribedItemType, title: 'Licentia', entityid: 'ndmwtb', channelName: 'collections', last_update: new Date(Date.now() - 5 * 60 * 60 * 1000) },
        { id: 4, type: 'user' as SubscribedItemType, title: 'Pickysaurus', entityid: 31179975, channelName: 'authors', last_update: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000) },
    ],
};

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

export default function Tracking() {
    const { guild, guildImage, subs } = FIXTURE;

    return (
        <Content>
            <PageTitle>Tracking Summary</PageTitle>

            <div className="my-4 flex items-center gap-3 rounded bg-[#5865F2] p-2 text-body-lg">
                <img src={guildImage} alt="" className="size-16 flex-none rounded-2xl" />
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
