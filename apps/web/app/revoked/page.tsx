import type { Metadata } from 'next';
import { ActionLink, Centered, Content, MainImage, PageTitle, Subtext, Supertext } from '@/components/ui';

/**
 * Ported from revokesuccess.ejs.
 *
 * Express has no GET route for this - it renders the view straight from the POST /revoke
 * handler, so the page exists without a URL. Next renders a route or nothing, so this one
 * gets /revoked, and step 8's handler will redirect to it rather than rendering it. That
 * is also the better shape: a refresh on this page currently re-submits the unlink.
 */
export const metadata: Metadata = { title: 'Link Removed' };

export default function Revoked() {
    return (
        <Content>
            <PageTitle>Unlink Complete</PageTitle>
            <Subtext>Your Discord and Nexus Mods accounts are no longer linked.</Subtext>

            <MainImage
                src="/images/unlink.gif"
                alt="An animated image of a cowboy toy called Woody saying 'So long partner' the film Toy Story 3"
            />

            <div className="mt-8">
                <Supertext>All linked roles will be automatically removed from your account.</Supertext>
            </div>

            <div className="mt-6">
                <Centered>
                    <ActionLink newTab icon="/images/Discord.svg" href="discord://-/">Back to Discord</ActionLink>
                </Centered>
            </div>
        </Content>
    );
}
