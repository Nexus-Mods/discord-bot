import type { Metadata } from 'next';
import { PageTitle, Subtext, Text } from '@/components/ui';
import { manageableGuilds } from '@/lib/auth/guilds';
import { botInviteUrl } from '@/lib/invite';

/**
 * The landing page inside /manage: pick a server from the rail.
 *
 * It reads the same list the rail does; React's cache means one fetch serves both.
 */
export const metadata: Metadata = { title: 'Manage' };

export default async function Manage() {
    const { guilds, failed } = await manageableGuilds();

    if (failed) {
        return (
            <>
                <PageTitle>Manage your servers</PageTitle>
                <Subtext>
                    Discord would not return your servers just now. The sign-in may have
                    expired - signing out and back in usually fixes it.
                </Subtext>
            </>
        );
    }

    if (guilds.length === 0) {
        return (
            <>
                <PageTitle>Nothing to manage yet</PageTitle>
                <Subtext>
                    There are no servers here where you can manage this bot. That means either
                    the bot is not in the servers you manage, or you do not hold Manage
                    Channels or Manage Server in a server it is in.
                </Subtext>
                <Text>
                    <a href={botInviteUrl()} target="_blank" rel="noreferrer">Add the bot to a server</a> to get started.
                </Text>
            </>
        );
    }

    return (
        <>
            <PageTitle>Manage your servers</PageTitle>
            <Subtext>
                {guilds.length === 1
                    ? 'One server to manage. Choose it on the left.'
                    : `${guilds.length} servers to manage. Choose one on the left.`}
            </Subtext>
            <Text>
                Only servers where you hold Manage Channels or Manage Server are listed, and
                only where this bot is present.
            </Text>
        </>
    );
}
