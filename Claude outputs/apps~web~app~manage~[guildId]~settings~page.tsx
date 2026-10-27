import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReadOnlyNotice, Text } from '@/components/ui';
import { guildAccess } from '@/lib/auth/guilds';
import { GuildUnavailable } from '@/components/GuildUnavailable';
import { settingsFor } from '@/lib/manage/server';

/** What this server has configured. View only for now. */
export const metadata: Metadata = { title: 'Settings' };

const CONDITION_LABELS: Record<string, string> = {
    modDownloads: 'Total mod downloads',
    modsPublished: 'Mods published',
};

export default async function Settings({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    // Checked here as well as in the layout: a page that relies on its layout for
    // authorisation stops being safe the moment someone moves it.
    const { guild, unavailable } = await guildAccess(guildId);
    if (unavailable) return <GuildUnavailable />;
    if (!guild) notFound();

    const { settings, conditions, roleName, unconfigured } = await settingsFor(guildId);

    return (
        <>
            {!guild.canManageSettings && (
                <ReadOnlyNotice>
                    You can see this server&apos;s settings, but not change them. Changing
                    them needs the <strong>Manage Server</strong> permission in this Discord
                    server.
                </ReadOnlyNotice>
            )}

            {unconfigured && (
                <Text>
                    This server has no saved settings yet. The bot writes them the first
                    time one is set with <code className="font-mono">/settings</code>.
                </Text>
            )}

            <dl className="my-6 divide-y divide-neutral-700 rounded border border-neutral-700">
                {settings.map((setting) => (
                    <div key={setting.label} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 bg-neutral-800/60 p-4">
                        <dt className="w-48 flex-none text-title-sm">{setting.label}</dt>
                        <dd className="min-w-0 grow">
                            {setting.value
                                ? <span className="text-body-md">{setting.value}</span>
                                : <span className="text-body-md italic text-neutral-400">Not set</span>}
                            <p className="mt-1 text-body-sm text-neutral-400">{setting.hint}</p>
                        </dd>
                        <button
                            type="button"
                            disabled
                            title={guild.canManageSettings
                                ? 'Editing is not available yet'
                                : 'Needs the Manage Server permission'}
                            className="rounded border border-neutral-600 px-3 py-1 text-body-sm text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Change
                        </button>
                    </div>
                ))}
            </dl>

            <h2 className="mt-10 text-title-md">Claimable role conditions</h2>
            {conditions.length === 0 ? (
                <Text>
                    {roleName
                        ? `No conditions are set, so nobody can claim ${roleName} yet.`
                        : 'No claimable role is set for this server.'}
                </Text>
            ) : (
                <ul className="my-4 space-y-2">
                    {conditions.map((condition, i) => (
                        <li key={`${condition.type}-${condition.game}-${i}`} className="rounded border border-neutral-700 bg-neutral-800/60 p-3 text-body-md">
                            <strong>{CONDITION_LABELS[condition.type] ?? condition.type}</strong>
                            {' '}of at least <strong>{condition.min.toLocaleString()}</strong>
                            {condition.game && condition.game !== 'all' ? <> for <strong>{condition.game}</strong></> : ' across all games'}
                            {i < conditions.length - 1 && <span className="text-neutral-400"> — {condition.op}</span>}
                        </li>
                    ))}
                </ul>
            )}

            <Text>
                Changing settings from here is coming; for now use{' '}
                <code className="font-mono">/settings</code> in Discord.
            </Text>
        </>
    );
}
