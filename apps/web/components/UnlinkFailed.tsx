import { ActionLink, Centered, Content, ErrorDetail, MainImage, PageTitle, Subtext, Text } from '@/components/ui';

/**
 * The "unlinking failed" page body, ported from unlinkerrormessage.ejs.
 *
 * A component rather than only a page, because two routes need it: /unlink-error, which
 * the submit redirects to, and /revoke itself when the signed link does not verify.
 *
 * /revoke cannot redirect the way Express does - it sets a signed ErrorDetail cookie and
 * sends the user to /unlink-error, and a Next server component is not allowed to set a
 * cookie while rendering (only route handlers and actions can). The options were to pass
 * the message in the query string, which is the hole just closed on the error pages, or to
 * render the failure where it happened. The second is better anyway: no redirect, and the
 * URL still shows what the user clicked.
 */
export function UnlinkFailed({ error }: { error: string }) {
    return (
        <Content>
            {/* "Unlinked Failed" in the EJS. Left alone: fixing copy inside a port makes the
                diff between the two versions stop being a comparison. */}
            <PageTitle>Unlinked Failed</PageTitle>
            <Subtext>
                Well, this is unexpected. An error occurred when attempting to remove the link between
                your accounts. This could be a temporary issue or something caused by your{' '}
                <a target="_blank" rel="noreferrer" href="https://help.nexusmods.com/article/113-troubleshooting-website-issues">
                    browser setup
                </a>
                .
            </Subtext>

            <MainImage src="/images/unlinkerror.gif" alt="A monkey hitting a computer in frustration" />

            <Text>
                You can give it another try or report the issue in our{' '}
                <a target="_blank" rel="noreferrer" href="https://discord.gg/nexusmods">Discord Server</a>,
                including the error details below.
            </Text>

            <Centered>
                <ActionLink newTab icon="/images/retry.svg" href="discord://-/">
                    Run /unlink in Discord to try again
                </ActionLink>
            </Centered>

            <ErrorDetail>{error}</ErrorDetail>
        </Content>
    );
}
