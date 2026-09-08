import type { Metadata } from 'next';
import { ActionLink, Centered, Content, ErrorDetail, MainImage, PageTitle, Subtext, Text } from '@/components/ui';
import { ERROR_DETAIL_COOKIE, readSignedCookieFromStore } from '@/lib/link/cookies';

/**
 * Ported from errormessage.ejs. The route keeps its Express path, /oauth-error, because
 * DiscordOAuth.getOAuthUrl redirects here by name when the client id or redirect URI is
 * missing - changing the path would mean changing a package to suit a view.
 */
export const metadata: Metadata = { title: 'Authentication Error' };

/**
 * The message comes from the signed ErrorDetail cookie, not from `?error=`.
 *
 * Step 6 read a query parameter because there was no server behind the page to set a
 * cookie. That is now a hole: a query parameter is whatever the visitor's URL says, so
 * anyone could hand out a link to this page on the real domain with any text they liked in
 * the error box - "your account is locked, call this number" renders exactly as well as a
 * token exchange failure. A signed cookie can only have been set by this server, which is
 * why Express used one, and why the fallback below asks about cookies rather than about
 * the URL.
 *
 * Reading a cookie is a Request API, so this page is per-request without needing
 * `connection()`.
 */
const NO_ERROR = 'No error recorded. Are you blocking cookies?';

export default async function OAuthError() {
    const error = await readSignedCookieFromStore(ERROR_DETAIL_COOKIE) ?? NO_ERROR;

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
