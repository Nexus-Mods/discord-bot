import type { AutocompleteInteraction } from 'discord.js';
import { DiscordBotUser, DummyNexusModsUser } from '../api/DiscordBotUser.js';
import type { ClientExt } from '../types/DiscordTypes.js';
import type { IModsFilter } from '@nexusmods/nexus-api/queries/v2.js';
import type { ICollectionsFilter } from '@nexusmods/nexus-api/types/GQLTypes.js';
import type { Logger } from '@nexusmods/core/logger.js';

/**
 * Slash-command autocomplete handlers.
 *
 * These lived in api/util.ts, which made that module import DiscordBotUser as a value
 * (each one builds an anonymous `DummyNexusModsUser` to query the public API). Since
 * DiscordBotUser imports api/util.ts back, and api/users.ts sits between them, that one
 * import closed the largest runtime cycle in the codebase. They are Discord interaction
 * helpers rather than general utilities, so src/lib is where they belong.
 */

export async function autocompleteGameName(client: ClientExt, acInteraction: AutocompleteInteraction, logger: Logger) {
    const focused = acInteraction.options.getFocused().toLowerCase();
    try {
        let games = await client.gamesList!.getGames();
        if (focused !== '') games = games.filter(g => (g.name.toLowerCase().startsWith(focused) || g.domain_name.includes(focused)));
        await acInteraction.respond(
            games.map(g => ({ name: g.name, value: g.domain_name })).slice(0, 25)
        );
    }
    catch(err) {
        logger.warn('Error autocompleting games', {err});
        throw err;
    }
}

export async function autoCompleteModSearch(acInteraction: AutocompleteInteraction, logger: Logger, gameDomain?: string, gameId?: number) {
    const focused = acInteraction.options.getFocused();
    if (focused.length < 3) return await acInteraction.respond([]);
    try {
        const user = new DiscordBotUser(DummyNexusModsUser, logger);
        const modFilter: IModsFilter = {};
        if (focused) modFilter.name = [{ value: focused, op: 'WILDCARD' }];
        if (gameDomain) modFilter.gameDomainName = [{ value: gameDomain, op: 'EQUALS' }];
        if (gameId) modFilter.gameId = [{ value: String(gameId), op: 'EQUALS' }];
        const modSearch = await user.NexusMods.API.v2.Mods(
            modFilter,
            { endorsements: { direction: 'DESC' }}
        )
        await acInteraction.respond(
            modSearch.nodes.map(m => ({ name: `${m.name} (${m.game.name})`.substring(0, 99), value: m.uid }))
        );
    }
    catch(err) {
        logger.warn('Error autocompleting mods', {err});
        throw err;
    }
}

export async function autoCompleteCollectionSearch(acInteraction: AutocompleteInteraction, logger: Logger, gameDomain?: string) {
    const focused = acInteraction.options.getFocused();
    if (focused.length < 3) return await acInteraction.respond([]);
    try {
        const user = new DiscordBotUser(DummyNexusModsUser, logger);
        const filter: ICollectionsFilter = {};
        if (focused) filter.generalSearch = { value: focused, op: 'WILDCARD' };
        if (gameDomain) filter.gameDomain = { value: gameDomain, op: 'EQUALS' };
        const search = await user.NexusMods.API.v2.Collections(filter);
        await acInteraction.respond(
            search.nodes.map(c => ({ name: `${c.name} (${c.game.name})`.substring(0, 99), value: `${c.game.domainName}:${c.slug}` }))
        );
    }
    catch(err) {
        logger.warn('Error autocompleting mods', {err});
        throw err;
    }
}

export async function autoCompleteUserSearch(acInteraction: AutocompleteInteraction, logger: Logger) {
    const focused = acInteraction.options.getFocused();
    if (focused.length < 3) return await acInteraction.respond([]);
    try {
        const user = new DiscordBotUser(DummyNexusModsUser, logger);
        const search = await user.NexusMods.API.v2.Users(focused);
        await acInteraction.respond(
            search.map(u => ({ name: u.name, value: u.memberId.toString() }))
        );
    }
    catch(err) {
        logger.warn('Error autocompleting users', {err});
        throw err;
    }
}
