import type { Metadata } from 'next';
import { ActionLink, Centered, Content, ErrorDetail, MainImage, PageTitle, Subtext, Text } from '@/components/ui';
import { one, type SearchParams } from '@/lib/search';

/** Ported from unlinkerrormessage.ejs. Keeps the Express path, /unlink-error. */
export const metadata: Metadata = { title: 'Unlinking Error' };

const NO_ERROR = 'No error recorded. Are you blocking cookies?';

export default async function UnlinkError({ searchParams }: { searchParams: SearchParams }) {
    const error = one((await searchParams).error) ?? NO_ERROR;

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
