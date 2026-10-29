import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ReadOnlyNotice, Text } from '@/components/ui';
import { guildAccess } from '@/lib/auth/guilds';
import { GuildUnavailable } from '@/components/GuildUnavailable';
import { trackedItemFor } from '@/lib/manage/trackedItem';
import type { ResolvedConfigValue } from '@nexusmods/persistence/types/subscriptionConfig.js';
import { TrackedItemForm, DeleteTrackedItem } from './TrackedItemForm';

/**
 * One tracked item, and the controls for changing it.
 *
 * The form is a client component because it needs the pending and error states of the
 * action it submits to; everything around it - the facts, the advanced list - stays on the
 * server. Someone without Manage Channels sees the same controls, disabled, rather than a
 * different page: what a feed does is not the part that needs hiding.
 */
export const metadata: Metadata = { title: 'Tracked item' };


/**
 * Where a value came from. Worth saying out loud: "false because nobody set it" and
 * "false because someone chose it" look identical otherwise, and only one of them is
 * safe to change.
 */
function SourceBadge({ entry }: { entry: ResolvedConfigValue }) {
    const text = entry.source === 'set' ? 'set'
        : entry.source === 'inherited' ? `inherited from ${entry.spec?.inherits ?? 'elsewhere'}`
        : entry.source === 'undeclared' ? 'stored, not declared'
        : 'default';
    const tone = entry.source === 'set' ? 'bg-neutral-700 text-neutral-50'
        : entry.source === 'undeclared' ? 'bg-warning-900 text-warning-strong'
        : 'bg-neutral-800 text-neutral-400';
    return <span className={`rounded px-2 py-0.5 text-body-xs ${tone}`}>{text}</span>;
}

export default async function TrackedItem({
    params,
}: { params: Promise<{ guildId: string; itemId: string }> }) {
    // The page renders timestamps, so prerendering has to stop here.
    await connection();

    const { guildId, itemId } = await params;

    const { guild, unavailable } = await guildAccess(guildId);
    // A rate limit is not a permission denial.
    if (unavailable) return <GuildUnavailable />;
    if (!guild) notFound();

    const item = await trackedItemFor(guildId, Number(itemId));
    // Also the answer for an item that belongs to another guild: the lookup is scoped, so
    // a guessed id from elsewhere simply is not here.
    if (!item) notFound();

    return (
        <>
            <Text>
                <Link href={`/manage/${guildId}/tracked`} className="text-primary-400 hover:text-primary-strong">
                    ← Back to tracked items
                </Link>
            </Text>

            <h2 className="text-title-lg text-balance">{item.title}</h2>
            <p className="mt-1 text-body-sm uppercase tracking-wide text-neutral-400">{item.type}</p>

            {!guild.canManageFeeds && (
                <ReadOnlyNotice>
                    You can see this feed&apos;s settings, but not change them. Editing needs
                    the <strong>Manage Channels</strong> permission in this Discord server.
                </ReadOnlyNotice>
            )}

            <dl className="my-6 grid gap-x-8 gap-y-2 rounded border border-neutral-700 bg-neutral-800/60 p-4 sm:grid-cols-2">
                {item.facts.map((fact) => (
                    <div key={fact.label} className="flex gap-3 text-body-md">
                        <dt className="w-32 flex-none text-neutral-400">{fact.label}</dt>
                        <dd className="min-w-0 wrap-break-words">{fact.value}</dd>
                    </div>
                ))}
            </dl>

            <TrackedItemForm
                guildId={guildId}
                itemId={item.id}
                itemTitle={item.title}
                feedOptions={item.feedOptions}
                discordOptions={item.discordOptions}
                canManage={guild.canManageFeeds}
            />

            {item.advanced.length > 0 && (
                <>
                    <h3 className="mt-8 text-title-md">Advanced</h3>
                    <Text>
                        Every option this kind of feed can carry, and where its value comes
                        from. A <em>default</em> is what the bot does when nothing is stored,
                        not something anyone chose.
                    </Text>
                    <dl className="my-4 divide-y divide-neutral-700 rounded border border-neutral-700 bg-neutral-800/60">
                        {item.advanced.map((entry) => (
                            <div key={entry.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-body-md">
                                <dt className="w-56 flex-none font-mono text-body-sm text-neutral-400">
                                    {entry.key}
                                    {entry.spec?.readOnly && <span className="ml-2 not-italic text-neutral-500">(read only)</span>}
                                </dt>
                                <dd className="min-w-0 grow wrap-break-words font-mono text-body-sm">
                                    {entry.value === null ? <span className="text-neutral-500">—</span> : String(entry.value)}
                                </dd>
                                <SourceBadge entry={entry} />
                            </div>
                        ))}
                    </dl>
                </>
            )}

            {guild.canManageFeeds && (
                <DeleteTrackedItem guildId={guildId} itemId={item.id} itemTitle={item.title} />
            )}

        </>
    );
}
