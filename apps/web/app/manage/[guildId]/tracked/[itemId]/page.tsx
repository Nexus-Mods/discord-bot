import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ReadOnlyNotice, Text } from '@/components/ui';
import { guildAccess } from '@/lib/auth/guilds';
import { GuildUnavailable } from '@/components/GuildUnavailable';
import { trackedItemFor } from '@/lib/manage/trackedItem';
import type { Preference } from '@/lib/manage/trackedItem';
import type { ResolvedConfigValue } from '@nexusmods/persistence/types/subscriptionConfig.js';

/**
 * One tracked item, with the controls it will have - all of them disabled.
 *
 * Nothing here saves yet. The controls are rendered anyway so the shape of the form is
 * settled before anything can write through it, and so the permission story is visible:
 * someone without Manage Channels sees exactly what they would be able to change if they
 * had it.
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

function Toggle({ preference, enabled }: { preference: Preference; enabled: boolean }) {
    const id = `pref-${preference.name}`;
    return (
        <div className="flex items-start gap-3 p-4">
            <input
                type="checkbox"
                id={id}
                name={preference.name}
                defaultChecked={Boolean(preference.value)}
                disabled
                className="mt-1 size-4 flex-none accent-primary-400 disabled:opacity-60"
            />
            <div className="min-w-0">
                <label htmlFor={id} className="text-title-sm">
                    {preference.label}
                    {preference.notImplemented && (
                        <span className="ml-2 text-body-xs font-normal text-neutral-500">not used yet</span>
                    )}
                </label>
                <p className="mt-1 text-body-sm text-neutral-400">
                    {preference.hint}
                    {preference.isSet === false && (
                        <span className="text-neutral-500">
                            {' '}Currently {preference.inherits ? `inherited from ${preference.inherits}` : 'the default'}.
                        </span>
                    )}
                </p>
            </div>
            {!enabled && <span className="sr-only">Not editable</span>}
        </div>
    );
}

function TextField({ preference }: { preference: Preference }) {
    const id = `pref-${preference.name}`;
    return (
        <div className="p-4">
            <label htmlFor={id} className="text-title-sm">{preference.label}</label>
            <p className="mb-2 mt-1 text-body-sm text-neutral-400">{preference.hint}</p>
            <input
                type="text"
                id={id}
                name={preference.name}
                defaultValue={typeof preference.value === 'string' ? preference.value : ''}
                placeholder="Nothing set"
                disabled
                className="w-full max-w-prose rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-body-md disabled:opacity-60"
            />
        </div>
    );
}


/**
 * One labelled set of controls.
 *
 * Two groups rather than one list, because they answer different questions - what gets
 * posted, and how it is posted - and they happen to live in different places: the feed
 * options are keys in the config blob, the Discord options are columns on the row.
 *
 * Nothing is rendered for an empty group. A mod or collection feed has no feed options at
 * all; an empty box under a heading reads as something broken.
 */
function OptionGroup({
    title, description, options, canManage, itemTitle,
}: {
    title: string;
    description: string;
    options: Preference[];
    canManage: boolean;
    itemTitle: string;
}) {
    if (options.length === 0) return null;

    return (
        <>
            <h3 className="mt-8 text-title-md">{title}</h3>
            <p className="mt-1 text-body-sm text-neutral-400">{description}</p>
            <form className="my-4 divide-y divide-neutral-700 rounded border border-neutral-700 bg-neutral-800/60">
                <fieldset disabled>
                    {/* Disabled on the fieldset as well as each input: one attribute that
                        cannot be missed off a control added later. */}
                    <legend className="sr-only">{title} for {itemTitle}</legend>
                    {options.map((preference) => (
                        preference.kind === 'toggle'
                            ? <Toggle key={preference.name} preference={preference} enabled={canManage} />
                            : <TextField key={preference.name} preference={preference} />
                    ))}
                </fieldset>
            </form>
        </>
    );
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

            <OptionGroup
                title="Feed Options"
                description="What this feed posts. Stored in the item's config."
                options={item.feedOptions}
                canManage={guild.canManageFeeds}
                itemTitle={item.title}
            />

            <OptionGroup
                title="Discord Options"
                description="How it posts to Discord."
                options={item.discordOptions}
                canManage={guild.canManageFeeds}
                itemTitle={item.title}
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

            <Text>
                Saving is not available yet. For now, change tracking with{' '}
                <code className="font-mono">/track</code> and{' '}
                <code className="font-mono">/untrack</code> in Discord.
            </Text>
        </>
    );
}
