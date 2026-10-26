import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { fetchUserGuilds } from '@nexusmods/auth/discordLogin.js';
import { logger } from '@nexusmods/core/logger.js';
import { ActionButton, Content, PageTitle, Subtext, Supertext } from '@/components/ui';
import { currentSession } from '@/lib/auth/session';
import { manageable } from '@/lib/auth/permissions';
import type { GuildAccess } from '@/lib/auth/permissions';
import { guild as botGuild } from '@/lib/discordDirectory';

/**
 * The whole authorisation model on one page, with no feature attached to it.
 *
 * It answers the three questions the portal will be built on: who are you, which of your
 * servers is this bot in, and what are you allowed to do in each. Getting this wrong here
 * shows someone a list; getting it wrong in a release that can write would delete their
 * feeds. That is the reason this ships first.
 */
export const metadata: Metadata = { title: 'Your servers' };

/**
 * Only the guilds the user can actually manage are checked against the bot.
 *
 * The alternative - listing every guild the bot is in and intersecting - is thirteen
 * paginated calls for 2,400 servers. Filtering by permission first usually leaves a
 * handful, and a handful of lookups is cheap.
 */
async function withBotPresence(guilds: GuildAccess[]): Promise<{ guild: GuildAccess; botIsIn: boolean }[]> {
    return Promise.all(guilds.map(async (g) => ({ guild: g, botIsIn: (await botGuild(g.id)) !== null })));
}

export default async function Me() {
    // Prerendering stops here: this page is about the person asking for it.
    await connection();

    const session = await currentSession();
    if (!session) redirect('/');

    let rows: { guild: GuildAccess; botIsIn: boolean }[] = [];
    let failed = false;
    try {
        rows = await withBotPresence(manageable(await fetchUserGuilds(session.accessToken)));
    }
    catch (err) {
        // An expired or revoked token lands here. Showing an empty list would read as
        // "you manage nothing", which is a different and more alarming statement.
        logger.warn('Could not read the guild list', err);
        failed = true;
    }

    const present = rows.filter((r) => r.botIsIn);
    const absent = rows.filter((r) => !r.botIsIn);

    return (
        <Content>
            <PageTitle>Signed in as {session.name}</PageTitle>

            <Subtext>
                This page exists to prove the sign-in works. It shows what the site knows
                about you and what it would let you manage - nothing here can be changed yet.
            </Subtext>

            {failed ? (
                <p className="my-8 text-body-md text-warning-strong">
                    Discord would not return your servers. The sign-in may have expired -
                    signing out and back in should fix it.
                </p>
            ) : (
                <>
                    <h2 className="mt-8 text-title-md">
                        Servers you manage, where this bot is present ({present.length})
                    </h2>
                    <GuildTable rows={present} empty="None - either the bot is not in the servers you manage, or you do not manage any." />

                    {absent.length > 0 && (
                        <>
                            <h2 className="mt-10 text-title-md">
                                Servers you manage, without this bot ({absent.length})
                            </h2>
                            <Supertext>
                                Listed so the difference is visible. The portal will never show these.
                            </Supertext>
                            <GuildTable rows={absent} empty="" />
                        </>
                    )}
                </>
            )}

            <form action="/logout" method="post" className="my-10">
                <ActionButton type="submit">Sign out</ActionButton>
            </form>
        </Content>
    );
}

const COLUMNS = ['Server', 'Feeds', 'Settings', 'Why'];

function GuildTable({ rows, empty }: { rows: { guild: GuildAccess; botIsIn: boolean }[]; empty: string }) {
    if (rows.length === 0 && !empty) return null;

    return (
        <div className="my-4 overflow-x-auto rounded border border-neutral-700">
            <table className="w-full border-collapse text-body-md">
                <thead>
                    <tr className="bg-neutral-800 text-left text-title-sm uppercase text-info-moderate">
                        {COLUMNS.map((c) => <th key={c} scope="col" className="whitespace-nowrap p-3">{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={COLUMNS.length} className="p-3 text-center italic text-neutral-400">{empty}</td>
                        </tr>
                    ) : rows.map(({ guild: g }) => (
                        <tr key={g.id} className="border-t border-neutral-700 bg-neutral-800/60">
                            <td className="p-3">{g.name}</td>
                            <td className="p-3">{g.canManageFeeds ? 'Yes' : 'No'}</td>
                            <td className="p-3">{g.canManageSettings ? 'Yes' : 'No'}</td>
                            <td className="p-3 text-neutral-400">
                                {g.owner ? 'Server owner' : 'Discord permissions'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
