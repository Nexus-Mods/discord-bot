import { connection } from 'next/server';
import { calcUptime } from '@nexusmods/core/formatting.js';
import { ActionLink, Content, PageTitle, Supertext } from '@/components/ui';
import { WEB_VERSION } from '@/lib/version';

/**
 * The status page, ported from content.ejs.
 *
 * Express fills `timestamp`, `version` and `upTime` from the running process and
 * `clientId` from the environment.
 *
 * All three are local to this process, which is not what the earlier "version and uptime
 * are the bot's" note assumed. The version is this workspace's, which the lockstep test
 * makes the bot's as well. And the uptime Express reports is
 * `calcUptime(process.uptime())` in dist/web.js - the *auth site's* uptime, never the
 * gateway's. It reads like the bot's because the two containers restart together, so a
 * bot that was crash-looping while the web container stayed up would show a reassuring
 * number. Same value here, labelled for what it measures.
 *
 * `clientId` is public - it is in the invite URL on the App Directory listing - so it
 * comes straight from the environment with no server round trip.
 *
 * `await connection()` rather than `export const dynamic = 'force-dynamic'`. Three things
 * on this page differ per request and none of them is a Request-time API the framework can
 * see: a clock, an uptime counter and nothing else. connection() is what the bundled docs
 * give for exactly that - their example is `new Date()` - and `dynamic` is the previous
 * model, absent from Next 16's route segment config table. Relying instead on the layout's
 * headers() call to keep this page dynamic would work today and break the moment the
 * layout stops reading a header.
 */

const DISCORD_ICON = '/images/Discord.svg';

export default async function Home() {
    // Prerendering stops here. Everything below is per request.
    await connection();

    const clientId = process.env.DISCORD_CLIENT_ID ?? '';
    const uptime = calcUptime(process.uptime());

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
                <Supertext>Version: {WEB_VERSION} | Site uptime: {uptime}</Supertext>
            </div>
        </Content>
    );
}
