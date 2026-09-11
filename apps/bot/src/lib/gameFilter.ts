import Fuse, { type IFuseOptions } from 'fuse.js';
import type { IGameStatic } from '@nexusmods/nexus-api/queries/other.js';
import type { BotServer } from '@nexusmods/persistence/types/servers.js';

/**
 * Fuzzy game lookup, shared by the search subcommands.
 *
 * These options are lifted verbatim from search.ts - the weighting matters, since
 * an exact id match should beat a loose name match.
 */
const fuseOptions: IFuseOptions<IGameStatic> = {
    shouldSort: true,
    findAllMatches: true,
    threshold: 0.4,
    location: 0,
    distance: 7,
    minMatchCharLength: 6,
    keys: [
        { name: 'name', weight: 0.1 },
        { name: 'id', weight: 0.6 },
        { name: 'domain_name', weight: 0.3 },
    ],
};

/** Games matching a free-text query, best first. */
export function searchGamesByName(query: string, allGames: IGameStatic[]): IGameStatic[] {
    return new Fuse(allGames, fuseOptions).search(query).map((r) => r.item);
}

/**
 * Work out which game a search should be filtered to: the one named in the command
 * if it matches, otherwise the server's default.
 *
 * searchMods and searchCollections each had a copy of this, and the copies had
 * drifted. One tested `gameQuery !== ''` and the other
 * `!['', undefined, null].includes(gameQuery)`; one read the server default with `??`
 * and the other with `||`. The `??` version kept an empty-string game_filter instead
 * of falling back to 0, so a server with a blank filter behaved differently between
 * the two subcommands. This takes the `||` behaviour, which is the one that works.
 */
export function resolveGameFilter(
    gameQuery: string | undefined | null,
    server: BotServer | null,
    allGames: IGameStatic[],
): { gameIdFilter: number; filterGame: IGameStatic | undefined } {
    let gameIdFilter = parseInt(server?.game_filter || '0') || 0;

    if (gameQuery && allGames.length) {
        const [closest] = searchGamesByName(gameQuery, allGames);
        if (closest) gameIdFilter = closest.id;
    }

    return { gameIdFilter, filterGame: allGames.find((g) => g.id === gameIdFilter) };
}
