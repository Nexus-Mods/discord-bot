import type { Metadata } from 'next';
import { ActionLink, Centered, Content, MainImage, PageTitle, Subtext, Supertext } from '@/components/ui';
import { numericId, one, type SearchParams } from '@/lib/search';

/**
 * Ported from linkconfirm.ejs, the last page of the account link.
 *
 * Express renders this with the four values it has just written to the database. Here
 * they come from the query string, which is what the redirect will carry in step 7 - and
 * which is why the ids are checked before they reach an href.
 */
export const metadata: Metadata = { title: 'Account Linked' };

export default async function Success({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const discord = one(params.discord) ?? 'your Discord account';
    const nexus = one(params.nexus) ?? 'your Nexus Mods account';
    const discordId = numericId(one(params.discordId));
    const nexusId = numericId(one(params.nexusId));

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
