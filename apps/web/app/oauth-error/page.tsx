import type { Metadata } from 'next';
import { ActionLink, Centered, Content, ErrorDetail, MainImage, PageTitle, Subtext, Text } from '@/components/ui';
import { one, type SearchParams } from '@/lib/search';

/**
 * Ported from errormessage.ejs. The route keeps its Express path, /oauth-error, because
 * DiscordOAuth.getOAuthUrl redirects here by name when the client id or redirect URI is
 * missing - changing the path would mean changing a package to suit a view.
 */
export const metadata: Metadata = { title: 'Authentication Error' };

const NO_ERROR = 'No error recorded. Are you blocking cookies?';

export default async function OAuthError({ searchParams }: { searchParams: SearchParams }) {
    const error = one((await searchParams).error) ?? NO_ERROR;

    return (
        <Content>
            <PageTitle>Authentication Failed</PageTitle>
            <Subtext>
                Drat! And double drat! An error occured while attempting to link your Nexus Mods and
                Discord accounts. This could be a temporary issue or something caused by your{' '}
                <a target="_blank" rel="noreferrer" href="https://help.nexusmods.com/article/113-troubleshooting-website-issues">
                    browser setup
                </a>
                .
            </Subtext>

            <MainImage src="/images/standby.gif" alt="Please stand by" />

            <Text>
                You can give it another try or report the issue in our{' '}
                <a target="_blank" rel="noreferrer" href="https://discord.gg/nexusmods">Discord Server</a>,
                including the error details below.
            </Text>

            <Centered>
                <ActionLink icon="/images/retry.svg" href="/linked-role">Try again</ActionLink>
            </Centered>

            <ErrorDetail>{error}</ErrorDetail>
        </Content>
    );
}
