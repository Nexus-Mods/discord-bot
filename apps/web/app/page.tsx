import { ActionLink, Content, PageTitle, Supertext } from '@/components/ui';

/**
 * The status page, ported from content.ejs.
 *
 * Express fills `timestamp`, `version` and `upTime` from the running process and
 * `clientId` from the environment. This step ports the view, not the data path: version
 * and uptime are the bot's, and the bot is a different process, so they arrive in step 7
 * over the same route the Express version uses. Until then they read as unknown rather
 * than as a plausible-looking zero.
 *
 * `clientId` is public - it is in the invite URL on the App Directory listing - so it
 * comes straight from the environment with no server round trip.
 */
export const dynamic = 'force-dynamic';

const DISCORD_ICON = '/images/Discord.svg';

export default function Home() {
    const clientId = process.env.DISCORD_CLIENT_ID ?? '';

    return (
        <Content>
            <PageTitle>Discord bot is online.</PageTitle>
            <Supertext>{new Date().toUTCString()}</Supertext>

            <div className="mt-6 flex flex-wrap gap-2">
                <ActionLink
                    newTab
                    icon={DISCORD_ICON}
                    href={`https://discord.com/api/v9/oauth2/authorize?client_id=${clientId}&scope=applications.commands%20bot`}
                >
                    Add to server
                </ActionLink>
                <ActionLink newTab icon={DISCORD_ICON} href={`https://discord.com/application-directory/${clientId}`}>
                    View in App Directory
                </ActionLink>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
                <ActionLink newTab icon="/images/readme.svg" href="https://modding.wiki/en/nexusmods/discord-bot">
                    Documentation
                </ActionLink>
                <ActionLink newTab icon="/images/github-mark-white.svg" href="https://github.com/Nexus-Mods/discord-bot/">
                    Source Code
                </ActionLink>
            </div>

            <div className="mt-6">
                <Supertext>Version: unknown | Uptime: unknown</Supertext>
            </div>
        </Content>
    );
}
