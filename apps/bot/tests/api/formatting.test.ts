import { describe, it, expect } from 'vitest';
import { calcUptime, nexusModsTrackingUrl, gameArt } from '../../src/api/formatting.js';

describe('calcUptime', () => {
    it.each([
        [0, '0d 0h 0m 0s'],
        [59, '0d 0h 0m 59s'],
        [60, '0d 0h 1m 0s'],
        [3600, '0d 1h 0m 0s'],
        [86_400, '1d 0h 0m 0s'],
        [93_784, '1d 2h 3m 4s'],
    ])('formats %i seconds', (seconds, expected) => {
        expect(calcUptime(seconds)).toBe(expected);
    });

    it('rounds fractional seconds, as process.uptime() returns them', () => {
        expect(calcUptime(10.7)).toBe('0d 0h 0m 11s');
    });
});

describe('nexusModsTrackingUrl', () => {
    it('appends the source and medium parameters', () => {
        const url = new URL(nexusModsTrackingUrl('https://nexusmods.com/skyrim/mods/1'));
        expect(url.searchParams.get('utm_source')).toBe('discordbot');
        expect(url.searchParams.get('utm_medium')).toBe('app');
    });

    it('lowercases and underscores the content tag', () => {
        const url = new URL(nexusModsTrackingUrl('https://nexusmods.com/x', 'Game Feed'));
        expect(url.searchParams.get('utm_content')).toBe('game_feed');
    });

    it('keeps extra parameters', () => {
        const url = new URL(nexusModsTrackingUrl('https://nexusmods.com/x', 'search', { tab: 'files' }));
        expect(url.searchParams.get('tab')).toBe('files');
    });

    it('preserves the path it was given', () => {
        const url = new URL(nexusModsTrackingUrl('https://nexusmods.com/skyrim/mods/1'));
        expect(url.pathname).toBe('/skyrim/mods/1');
    });
});

describe('gameArt', () => {
    it('returns a tile URL for each known type', () => {
        expect(gameArt(1704, '4_3')).toContain('/4_3/tile_1704.jpg');
        expect(gameArt(1704, 'hero')).toContain('1704');
    });

    it('returns a string for an unspecified type', () => {
        expect(typeof gameArt(1704)).toBe('string');
    });
});
