import type { Metadata } from 'next';
import { ActionButton, Centered, Content, PageTitle, Subtext, Supertext, Text } from '@/components/ui';
import { one, type SearchParams } from '@/lib/search';

/**
 * Ported from revokeconfirmmessage.ejs: the "are you sure" before an account link is
 * removed.
 *
 * The form still POSTs to /revoke, which Express still handles - the same URL, the same
 * two hidden fields, the same method. That is the point of porting the views while the
 * server stays: this page is a drop-in replacement for the rendered HTML and nothing
 * behind it has to know.
 *
 * `id` and `token` come from the signed URL the bot sends; they are echoed straight back
 * as hidden fields, exactly as the EJS does, and are never interpolated into markup or a
 * URL here.
 */
export const metadata: Metadata = { title: 'Unlink Accounts' };

export default async function RevokeConfirm({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const nexusName = one(params.nexusName) ?? 'your Nexus Mods account';
    const discordName = one(params.discordName) ?? 'your Discord account';
    const id = one(params.id) ?? '';
    const token = one(params.token) ?? '';

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
                <form method="POST" action="/revoke">
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
