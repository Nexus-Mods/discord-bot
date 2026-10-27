import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ReadOnlyNotice, Text } from '@/components/ui';
import { guildAccess } from '@/lib/auth/guilds';
import { GuildUnavailable } from '@/components/GuildUnavailable';
import { trackedItemFor } from '@/lib/manage/trackedItem';
import type { Preference } from '@/lib/manage/trackedItem';

/**
 * One tracked item, with the controls it will have - all of them disabled.
 *
 * Nothing here saves yet. The controls are rendered anyway so the shape of the form is
 * settled before anything can write through it, and so the permission story is visible:
 * someone without Manage Channels sees exactly what they would be able to change if they
 * had it.
 */
export const metadata: Metadata = { title: 'Tracked item' };

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
                <label htmlFor={id} className="text-title-sm">{preference.label}</label>
                <p className="mt-1 text-body-sm text-neutral-400">{preference.hint}</p>
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

            <h3 className="mt-8 text-title-md">Feed options</h3>
            <form className="my-4 divide-y divide-neutral-700 rounded border border-neutral-700 bg-neutral-800/60">
                <fieldset disabled>
                    {/* Disabled on the fieldset as well as each input: one attribute that
                        cannot be missed off a control added later. */}
                    <legend className="sr-only">Feed options for {item.title}</legend>
                    {item.preferences.map((preference) => (
                        preference.kind === 'toggle'
                            ? <Toggle key={preference.name} preference={preference} enabled={guild.canManageFeeds} />
                            : <TextField key={preference.name} preference={preference} />
                    ))}
                </fieldset>
            </form>

            {item.advanced.length > 0 && (
                <>
                    <h3 className="mt-8 text-title-md">Advanced</h3>
                    <Text>
                        Stored preferences this page does not have controls for yet, shown as
                        they are held.
                    </Text>
                    <dl className="my-4 divide-y divide-neutral-700 rounded border border-neutral-700 bg-neutral-800/60">
                        {item.advanced.map((entry) => (
                            <div key={entry.label} className="flex gap-3 p-3 text-body-md">
                                <dt className="w-40 flex-none font-mono text-body-sm text-neutral-400">{entry.label}</dt>
                                <dd className="min-w-0 wrap-break-words font-mono text-body-sm">{entry.value}</dd>
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
