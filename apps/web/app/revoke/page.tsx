import type { Metadata } from 'next';
import { ActionButton, Centered, Content, PageTitle, Subtext, Supertext, Text } from '@/components/ui';
import { UnlinkFailed } from '@/components/UnlinkFailed';
import { one, type SearchParams } from '@/lib/search';
import { verifyUnlinkRequest } from '@/lib/link/unlink';
import { revokeAccountLink } from './actions';

/**
 * GET /revoke - ported from revokeconfirmmessage.ejs: the "are you sure" before an account
 * link is removed.
 *
 * Nothing is deleted here, which is the point of the two-step: an image tag or a link
 * unfurl in a chat client cannot trigger an unlink by fetching a URL.
 *
 * The names now come from the database, after verifying the signature on the link. Step 6
 * read them from the query string, which meant this page would print whatever names the
 * URL claimed for whatever id it named - see verifyUnlinkRequest for why that matters on
 * the page a user reads before deciding.
 *
 * On a bad link it renders the failure instead of redirecting to /unlink-error, because a
 * server component cannot set the ErrorDetail cookie that page reads. UnlinkFailed carries
 * the explanation.
 */
export const metadata: Metadata = { title: 'Unlink Accounts' };

export default async function RevokeConfirm({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const id = one(params.id) ?? '';
    const token = one(params.token) ?? '';

    let nexusName: string;
    let discordName: string;
    try {
        const user = await verifyUnlinkRequest(id, token);
        nexusName = user.NexusModsUsername ?? 'your Nexus Mods account';
        discordName = user.DiscordId;
    }
    catch (err) {
        return <UnlinkFailed error={`Error unlinking accounts: ${(err as Error).message}`} />;
    }

    return (
        <Content>
            <PageTitle>Unlink your accounts?</PageTitle>
            <Subtext>
                This will remove the link between <strong>{nexusName}</strong> on Nexus Mods and{' '}
                <strong>{discordName}</strong> on Discord.
            </Subtext>

            <Text>
                All linked roles will be removed from your Discord account and you will lose access to
                Game Feeds, Search and other features until you link again.
            </Text>

            <Centered>
                {/* The id and token are echoed back as hidden fields, exactly as the EJS does,
                    and the action verifies them again rather than trusting this page. */}
                <form action={revokeAccountLink}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="token" value={token} />
                    <ActionButton type="submit">
                        Yes, unlink my accounts
                    </ActionButton>
                </form>
            </Centered>

            <div className="mt-8">
                <Supertext>If you did not ask to unlink, close this page and nothing will change.</Supertext>
            </div>
        </Content>
    );
}
