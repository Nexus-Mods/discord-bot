import type { Metadata } from 'next';
import { ActionLink, Centered, Content, MainImage, PageTitle, Subtext, Supertext } from '@/components/ui';
import { numericId, one, type SearchParams } from '@/lib/search';

/**
 * Ported from linkconfirm.ejs, the last page of the account link.
 *
 * The four values arrive in the query string, put there by /nexus-mods-callback after it
 * has written the row.
 *
 * `d_id` and `n_id`, not `discordId` and `nexusId`. Those are what the EJS template calls
 * them, and step 6 read the template's variable names off the view - but Express's handler
 * maps them: `discordId: req.query['d_id']`. Nothing was visibly broken, because the page
 * falls back to a bold name when an id is missing, so the only symptom was that the two
 * profile links silently stopped being links. Found while writing the redirect that
 * supplies them.
 */
export const metadata: Metadata = { title: 'Account Linked' };

export default async function Success({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const discord = one(params.discord) ?? 'your Discord account';
    const nexus = one(params.nexus) ?? 'your Nexus Mods account';
    const discordId = numericId(one(params.d_id));
    const nexusId = numericId(one(params.n_id));

    return (
        <Content>
            <PageTitle>Success!</PageTitle>
            <Subtext>
                {discordId
                    ? <a href={`discord://discordapp.com/users/${discordId}`}>@{discord}</a>
                    : <strong>@{discord}</strong>}
                {' has been successfully linked to '}
                {nexusId
                    ? <a href={`https://nexusmods.com/users/${nexusId}`}>{nexus}</a>
                    : <strong>{nexus}</strong>}
                .
            </Subtext>

            <MainImage
                src="/images/success.gif"
                alt="An animated image showing Dutch and Dillon performing an epic handshake in the film Predator"
            />

            <div className="mt-8">
                <Supertext>
                    Use the &ldquo;Linked Roles&rdquo; option in servers with the Nexus Mods Discord bot to claim your roles.
                </Supertext>
            </div>

            <div className="mt-6">
                <Centered>
                    <ActionLink newTab icon="/images/Discord.svg" href="discord://-/">Back to Discord</ActionLink>
                </Centered>
            </div>
        </Content>
    );
}
