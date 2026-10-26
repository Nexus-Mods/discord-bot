import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The rail asks "is the bot in this guild" once per manageable server on every
 * navigation. The memo is what stops that being a round trip to Discord each time -
 * and the thing to get right is which answers are safe to keep.
 */

const get = vi.fn();

vi.mock('@nexusmods/core/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@discordjs/rest', () => ({
    REST: class { setToken() { return this; } get = get; },
    CDN: class { icon(id: string, hash: string) { return `https://cdn.discordapp.com/icons/${id}/${hash}.webp`; } },
}));

const { guild, forgetGuild } = await import('@/lib/discordDirectory');

const notFound = () => Object.assign(new Error('Unknown Guild'), { status: 404 });

beforeEach(() => {
    vi.clearAllMocks();
    process.env.DISCORD_TOKEN = 'token';
    forgetGuild('g1');
});

afterEach(() => { vi.useRealTimers(); });

describe('the guild memo', () => {
    it('asks Discord once and serves the rest from memory', async () => {
        get.mockResolvedValue({ id: 'g1', name: 'A server', icon: 'hash' });

        const first = await guild('g1');
        const second = await guild('g1');

        expect(first).toEqual(second);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('remembers that the bot is NOT in a guild', async () => {
        // The expensive case: a rail where several servers have no bot would otherwise
        // re-ask about every one of them on every page load.
        get.mockRejectedValue(notFound());

        expect(await guild('g1')).toBeNull();
        expect(await guild('g1')).toBeNull();
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('does not cache a transient failure', async () => {
        // Five minutes of an outage inherited by every later request would turn a blip
        // into an incident.
        get.mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { status: 503 }));
        await expect(guild('g1')).rejects.toThrow();

        get.mockResolvedValue({ id: 'g1', name: 'A server', icon: null });
        expect(await guild('g1')).toMatchObject({ name: 'A server' });
    });

    it('asks again once the entry has aged out', async () => {
        vi.useFakeTimers();
        get.mockResolvedValue({ id: 'g1', name: 'Before', icon: null });
        expect(await guild('g1')).toMatchObject({ name: 'Before' });

        vi.advanceTimersByTime(5 * 60 * 1000 + 1);
        get.mockResolvedValue({ id: 'g1', name: 'After', icon: null });
        expect(await guild('g1')).toMatchObject({ name: 'After' });
        expect(get).toHaveBeenCalledTimes(2);
    });

    it('can be told to forget one guild', async () => {
        get.mockResolvedValue({ id: 'g1', name: 'A server', icon: null });
        await guild('g1');
        forgetGuild('g1');
        await guild('g1');
        expect(get).toHaveBeenCalledTimes(2);
    });
});
