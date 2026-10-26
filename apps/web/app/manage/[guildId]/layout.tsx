import { notFound } from 'next/navigation';
import { Tabs } from '@/components/Tabs';
import { acronym } from '@/lib/acronym';
import { guildAccess } from '@/lib/auth/guilds';
import { PermissionSummary } from '@/components/Permissions';

/**
 * One guild's page: a header and two tabs.
 *
 * notFound() rather than a message, for a guild this visitor cannot manage. Telling
 * someone "you do not have permission here" confirms the server exists and that this bot
 * is in it; 404 says only that there is nothing here for them.
 */
export default async function GuildLayout({
    children, params,
}: { children: React.ReactNode; params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const guild = await guildAccess(guildId);
    if (!guild) notFound();

    return (
        <>
            <header className="flex items-start gap-4">
                {guild.iconUrl
                    ? <img src={guild.iconUrl} alt="" width={56} height={56} className="size-14 rounded-2xl object-cover" />
                    : (
                        <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-neutral-800 text-title-md">
                            {acronym(guild.name)}
                        </span>
                    )}
                <div className="min-w-0">
                    <h1 className="text-heading-lg text-balance">{guild.name}</h1>
                    <PermissionSummary
                        canManageFeeds={guild.canManageFeeds}
                        canManageSettings={guild.canManageSettings}
                        owner={guild.owner}
                    />
                </div>
            </header>

            <Tabs
                tabs={[
                    { href: `/manage/${guildId}/tracked`, label: 'Tracked Items', segment: 'tracked' },
                    { href: `/manage/${guildId}/settings`, label: 'Settings', segment: 'settings' },
                ]}
            />

            {children}
        </>
    );
}
