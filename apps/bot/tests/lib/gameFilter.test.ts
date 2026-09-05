import { describe, it, expect } from 'vitest';
import { resolveGameFilter, searchGamesByName } from '../../src/lib/gameFilter.js';
import type { IGameStatic } from '@nexusmods/nexus-api/queries/other.js';
import type { BotServer } from '../../src/types/servers.js';

const games = [
    { id: 1704, name: 'Skyrim Special Edition', domain_name: 'skyrimspecialedition' },
    { id: 110, name: 'Skyrim', domain_name: 'skyrim' },
    { id: 1151, name: 'Fallout 4', domain_name: 'fallout4' },
] as IGameStatic[];

const server = (game_filter: string | undefined) => ({ game_filter }) as BotServer;

describe('searchGamesByName', () => {
    it('finds a game by an approximate name', () => {
        expect(searchGamesByName('skyrim special', games)[0].id).toBe(1704);
    });

    it('finds a game by domain name', () => {
        expect(searchGamesByName('fallout4', games)[0].id).toBe(1151);
    });

    it('returns nothing for a query that matches nothing', () => {
        expect(searchGamesByName('zzzzzzzzzz', games)).toEqual([]);
    });
});

describe('resolveGameFilter', () => {
    it('prefers the game named in the command over the server default', () => {
        expect(resolveGameFilter('fallout4', server('110'), games).gameIdFilter).toBe(1151);
    });

    it('falls back to the server default when no game is named', () => {
        expect(resolveGameFilter('', server('110'), games).filterGame?.name).toBe('Skyrim');
    });

    it.each([undefined, null, ''])('treats %j as "no game named"', (query) => {
        expect(resolveGameFilter(query, server('110'), games).gameIdFilter).toBe(110);
    });

    it('treats a blank server filter as no filter', () => {
        // searchCollections read this with ?? rather than ||, so an empty-string
        // game_filter survived as the filter value instead of falling back to 0 -
        // the two subcommands disagreed for a server configured this way.
        expect(resolveGameFilter('', server(''), games).gameIdFilter).toBe(0);
        expect(resolveGameFilter('', server(undefined), games).gameIdFilter).toBe(0);
    });

    it('resolves to no game when the default id is unknown', () => {
        expect(resolveGameFilter('', server('999999'), games).filterGame).toBeUndefined();
    });
});
