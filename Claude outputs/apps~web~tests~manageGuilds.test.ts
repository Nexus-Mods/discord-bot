import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionFlagsBits } from 'discord-api-types/v10';

/**
 * The rail decides what a signed-in visitor is shown they can manage. Two ways to get it
 * wrong: list a server they have no business in, or drop one they do - the first is a
 * disclosure, the second is a support ticket.
 */

const MANAGE_CHANNELS = PermissionFlagsBits.ManageChannels.toString();
const SEND_MESSAGES = PermissionFlagsBits.SendMessages.toString();

vi.mock('@nexusmods/core/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const session = vi.fn(async () => ({ id: '1', name: 'Someone', avatar: null, accessToken: 'token' }));
vi.mock('@/lib/auth/session', () => ({ currentSession: () => session() }));

const userGuilds = vi.fn(async () => [] as unknown[]);
vi.mock('@nexusmods/auth/discordLogin.js', () => ({ fetchUserGuilds: () => userGuilds() }));

const botGuild = vi.fn(async (_id: string) => null as unknown);
vi.mock('@/lib/discordDirectory', () => ({ guild: (id: string) => botGuild(id) }));

const { manageableGuilds, forgetGuildList } = await import('@/lib/auth/guilds');
const { acronym } = await import('@/lib/acronym');

const guild = (over: Record<string, unknown> = {}) => ({
    id: '1', name: 'A server', icon: null, owner: false, permissions: MANAGE_CHANNELS, ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    // The guild list is cached per user for a minute, on globalThis - which is the point.
    // Tests share a process, so each one starts from an empty cache.
    forgetGuildList('1');
    forgetGuildList('2');
    // React's cache() keys on the module instance, so each test needs a fresh import
    // scope - vitest gives one per file, and these assertions never share a request.
    session.mockResolvedValue({ id: '1', name: 'Someone', avatar: null, accessToken: 'token' });
});

describe('manageableGuilds', () => {
    it('keeps only guilds the bot is actually in', async () => {
        userGuilds.mockResolvedValue([
            guild({ id: 'in', name: 'Bot is here' }),
            guild({ id: 'out', name: 'Bot is not here' }),
        ]);
        botGuild.mockImplementation(async (id: string) => (
            id === 'in' ? { id, name: 'Bot is here', iconUrl: 'https://cdn.discordapp.com/icons/in/hash.webp' } : null
        ));

        const { guilds, failed } = await manageableGuilds();
        expect(failed).toBe(false);
        expect(guilds.map((g) => g.id)).toEqual(['in']);
        expect(guilds[0].iconUrl).toContain('cdn.discordapp.com');
    });

    it('drops guilds where the user manages nothing, without asking Discord about them', async () => {
        userGuilds.mockResolvedValue([guild({ id: 'nope', permissions: SEND_MESSAGES })]);

        const { guilds } = await manageableGuilds();
        expect(guilds).toEqual([]);
        // The permission filter runs first: no point spending a REST call on a guild the
        // user could not manage even if the bot were there.
        expect(botGuild).not.toHaveBeenCalled();
    });

    it('reports a Discord failure as failed, not as an empty list', async () => {
        userGuilds.mockRejectedValue(new Error('token expired'));

        const { guilds, failed } = await manageableGuilds();
        expect(failed).toBe(true);
        expect(guilds).toEqual([]);
    });

    it('does not let one unreachable guild empty the rail', async () => {
        userGuilds.mockResolvedValue([guild({ id: 'ok', name: 'Fine' }), guild({ id: 'bad', name: 'Broken' })]);
        botGuild.mockImplementation(async (id: string) => {
            if (id === 'bad') throw new Error('Discord said no');
            return { id, name: 'Fine', iconUrl: null };
        });

        const { guilds } = await manageableGuilds();
        expect(guilds.map((g) => g.id)).toEqual(['ok']);
    });

    it('is empty and not failed when nobody is signed in', async () => {
        session.mockResolvedValue(null as never);

        const { guilds, failed } = await manageableGuilds();
        expect(guilds).toEqual([]);
        expect(failed).toBe(false);
        expect(userGuilds).not.toHaveBeenCalled();
    });

    it('treats an unreadable session cookie as signed out rather than throwing', async () => {
        session.mockRejectedValue(new Error('COOKIE_SECRET is not set.'));
        await expect(manageableGuilds()).resolves.toEqual({ guilds: [], failed: false });
    });
});

describe('ServerRailSkeleton', () => {
    it('keeps the rail\'s width, so the content does not jump when the tiles arrive', async () => {
        const { ServerRailSkeleton } = await import('@/components/ServerRail');
        const markup = JSON.stringify(ServerRailSkeleton());
        // Same px-3 gutter and size-12 tiles as the real rail.
        expect(markup).toContain('px-3');
        expect(markup).toContain('size-12');
        // Decorative: a screen reader should hear the real rail, not a row of nothing.
        expect(markup).toContain('aria-hidden');
    });
});

describe('acronym', () => {
    it.each([
        ['Nexus Mods', 'NM'],
        ['one', 'o'],
        ['A Very Long Server Name', 'AVL'],
        ['  padded   spaces  ', 'ps'],
    ])('reduces %s to %s', (name, expected) => {
        expect(acronym(name)).toBe(expected);
    });

    it('does not split an emoji in half', () => {
        // [...word][0] rather than word[0]: a surrogate pair indexed by [0] renders as a
        // replacement character.
        expect(acronym('🎮 Gaming')).toBe('🎮G');
    });

    it('survives a name that is only whitespace', () => {
        expect(acronym('   ')).toBe('');
    });
});

describe('the per-user guild list cache', () => {
    it('asks Discord once for a burst of navigation', async () => {
        // The rail renders, tabs prefetch, a page loads: several renders in a second,
        // all wanting the same list. Discord allows about one request per second for it.
        userGuilds.mockResolvedValue([guild({ id: 'g', name: 'Server' })]);
        botGuild.mockImplementation(async (id: string) => ({ id, name: 'Server', iconUrl: null }));

        await manageableGuilds();
        await manageableGuilds();
        await manageableGuilds();

        expect(userGuilds).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failure, so the next navigation retries', async () => {
        userGuilds.mockRejectedValueOnce(new Error('rate limited'));
        expect(await manageableGuilds()).toMatchObject({ failed: true });

        userGuilds.mockResolvedValue([guild({ id: 'g', name: 'Server' })]);
        botGuild.mockImplementation(async (id: string) => ({ id, name: 'Server', iconUrl: null }));
        expect(await manageableGuilds()).toMatchObject({ failed: false });
    });

    it('keys the cache per user, so one visitor cannot see another\'s servers', async () => {
        userGuilds.mockResolvedValue([guild({ id: 'theirs', name: 'Theirs' })]);
        botGuild.mockImplementation(async (id: string) => ({ id, name: 'Theirs', iconUrl: null }));
        await manageableGuilds();

        session.mockResolvedValue({ id: '2', name: 'Someone else', avatar: null, accessToken: 'other' });
        userGuilds.mockResolvedValue([guild({ id: 'mine', name: 'Mine' })]);
        botGuild.mockImplementation(async (id: string) => ({ id, name: 'Mine', iconUrl: null }));

        const { guilds } = await manageableGuilds();
        expect(guilds.map((g) => g.id)).toEqual(['mine']);
    });
});
