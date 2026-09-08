import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The tracking page's data path: one query, two REST calls and a join.
 *
 * Step 6 shipped this page with a fixture because wiring it needed database credentials.
 * The credentials are a deployment's, not a test's, so the two boundaries are mocked and
 * what is tested is the part that was actually written here - which channel name lands on
 * which row, what happens when there is no name to be had, and the order.
 */
const getSubscribedChannelsForGuild = vi.fn();
const getSubscribedItems = vi.fn();
const guild = vi.fn();
const channels = vi.fn();

vi.mock('@nexusmods/persistence/subscriptions.js', () => ({
    getSubscribedChannelsForGuild: (id: string) => getSubscribedChannelsForGuild(id),
    getSubscribedItems: (c: unknown) => getSubscribedItems(c),
}));

vi.mock('@/lib/discordDirectory', () => ({
    guild: (id: string) => guild(id),
    channels: (id: string) => channels(id),
}));

const { trackingFor } = await import('@/lib/tracking');

const ago = (ms: number) => new Date(Date.now() - ms);

beforeEach(() => {
    vi.clearAllMocks();
    guild.mockResolvedValue({ id: '1', name: 'Nexus Mods', iconUrl: 'https://cdn.test/icon.png' });
    channels.mockResolvedValue([
        { id: 'c1', name: 'mod-feed' },
        { id: 'c2', name: 'collections' },
    ]);
});

describe('trackingFor', () => {
    it('puts the right channel name on every row', async () => {
        getSubscribedChannelsForGuild.mockResolvedValue([
            { channel_id: 'c1' },
            { channel_id: 'c2' },
        ]);
        getSubscribedItems.mockImplementation((c: { channel_id: string }) => Promise.resolve(
            c.channel_id === 'c1'
                ? [{ id: 1, type: 'game', title: 'Skyrim', entityid: 1704, last_update: ago(1000) }]
                : [{ id: 2, type: 'collection', title: 'Licentia', entityid: 'ndmwtb', last_update: ago(2000) }],
        ));

        const tracking = await trackingFor('1');
        expect(tracking?.subs.map((s) => [s.id, s.channelName])).toEqual([[1, 'mod-feed'], [2, 'collections']]);
        expect(tracking?.guild).toBe('Nexus Mods');
    });

    /**
     * A channel the bot has been removed from, or that has been deleted, still has rows in
     * the database pointing at it. Express had a fallback for this and losing it would show
     * an empty column rather than a wrong one - quieter and harder to explain.
     */
    it('falls back when Discord has no name for a channel', async () => {
        getSubscribedChannelsForGuild.mockResolvedValue([{ channel_id: 'gone' }]);
        getSubscribedItems.mockResolvedValue([
            { id: 3, type: 'mod', title: 'SkyUI', entityid: '73', last_update: ago(1000) },
        ]);

        expect((await trackingFor('1'))?.subs[0].channelName).toBe('Unknown Channel');
    });

    it('sorts newest first across all channels, not within each', async () => {
        getSubscribedChannelsForGuild.mockResolvedValue([{ channel_id: 'c1' }, { channel_id: 'c2' }]);
        getSubscribedItems.mockImplementation((c: { channel_id: string }) => Promise.resolve(
            c.channel_id === 'c1'
                // Oldest and newest both in the first channel, so a per-channel sort or no
                // sort at all gives a different answer from a global one.
                ? [{ id: 1, last_update: ago(90_000) }, { id: 3, last_update: ago(1000) }]
                : [{ id: 2, last_update: ago(45_000) }],
        ));

        expect((await trackingFor('1'))?.subs.map((s) => s.id)).toEqual([3, 2, 1]);
    });

    it('returns null for a guild the bot cannot see, and asks the database nothing', async () => {
        guild.mockResolvedValue(null);
        expect(await trackingFor('999')).toBeNull();
        // The redirect happens without a query: an unknown guild id is not a database trip.
        expect(getSubscribedChannelsForGuild).not.toHaveBeenCalled();
    });

    it('handles a guild with no subscriptions', async () => {
        getSubscribedChannelsForGuild.mockResolvedValue([]);
        const tracking = await trackingFor('1');
        expect(tracking?.subs).toEqual([]);
        expect(getSubscribedItems).not.toHaveBeenCalled();
    });

    it('carries a missing guild icon through as null rather than the string "null"', async () => {
        // The EJS put this straight into src=, so a guild with no icon rendered a broken
        // image. The page skips the img when this is null.
        guild.mockResolvedValue({ id: '1', name: 'No Icon', iconUrl: null });
        getSubscribedChannelsForGuild.mockResolvedValue([]);
        expect((await trackingFor('1'))?.guildImage).toBeNull();
    });
});
