import { describe, it, expect, vi, beforeEach } from 'vitest';

const restGet = vi.fn();

vi.mock('discord.js', () => ({
    REST: class { setToken() { return this; } get(route: string) { return restGet(route); } },
    CDN: class { icon(id: string, hash: string, opts?: { size?: number }) { return `https://cdn.test/icons/${id}/${hash}.webp?size=${opts?.size}`; } },
    Routes: { guild: (id: string) => `/guilds/${id}`, guildChannels: (id: string) => `/guilds/${id}/channels` },
}));

const { createDiscordDirectory } = await import('../../src/server/discordDirectory.js');

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
const directory = createDiscordDirectory('token', logger);

function httpError(status: number) {
    return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe('DiscordDirectory.guild', () => {
    beforeEach(() => { restGet.mockReset(); logger.warn.mockReset(); });

    it('maps a guild to a summary with a CDN icon url', async () => {
        restGet.mockResolvedValue({ id: '99', name: 'Nexus Mods', icon: 'abc' });
        await expect(directory.guild('99')).resolves.toEqual({
            id: '99',
            name: 'Nexus Mods',
            iconUrl: 'https://cdn.test/icons/99/abc.webp?size=128',
        });
        expect(restGet).toHaveBeenCalledWith('/guilds/99');
    });

    it('returns a null icon rather than a broken url when the guild has none', async () => {
        restGet.mockResolvedValue({ id: '99', name: 'Nexus Mods', icon: null });
        await expect(directory.guild('99')).resolves.toMatchObject({ iconUrl: null });
    });

    // guilds.fetch() threw for an unknown id, so the `if (!knownGuild)` guard on the
    // tracking page could never fire and a guessed id became a 500.
    it.each([403, 404])('treats %i as "no such guild" rather than an error', async (status) => {
        restGet.mockRejectedValue(httpError(status));
        await expect(directory.guild('1')).resolves.toBeNull();
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('still throws when Discord fails for any other reason', async () => {
        restGet.mockRejectedValue(httpError(500));
        await expect(directory.guild('1')).rejects.toThrow('HTTP 500');
        expect(logger.warn).toHaveBeenCalled();
    });
});

describe('DiscordDirectory.channels', () => {
    beforeEach(() => { restGet.mockReset(); logger.warn.mockReset(); });

    it('fetches the guild once rather than once per channel', async () => {
        restGet.mockResolvedValue([{ id: '1', name: 'feeds' }, { id: '2', name: 'news' }]);
        await expect(directory.channels('99')).resolves.toEqual([
            { id: '1', name: 'feeds' },
            { id: '2', name: 'news' },
        ]);
        expect(restGet).toHaveBeenCalledTimes(1);
        expect(restGet).toHaveBeenCalledWith('/guilds/99/channels');
    });

    it('names a channel that has none, so the page renders', async () => {
        restGet.mockResolvedValue([{ id: '1', name: null }]);
        await expect(directory.channels('99')).resolves.toEqual([{ id: '1', name: 'Unknown Channel' }]);
    });

    it('returns nothing when the bot is no longer in the guild', async () => {
        restGet.mockRejectedValue(httpError(403));
        await expect(directory.channels('99')).resolves.toEqual([]);
    });
});
