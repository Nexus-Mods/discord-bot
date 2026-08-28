import { AutocompleteInteraction, EmbedBuilder } from "discord.js";
import { ClientExt } from "../types/DiscordTypes.js";
import { DiscordBotUser, DummyNexusModsUser } from "./DiscordBotUser.js";
import { IModsFilter } from "./queries/v2.js";
import { ICollectionsFilter } from "../types/GQLTypes.js";
// Logger moved to ./logger.ts. Re-exported so the existing imports keep working.
import { Logger } from './logger.js';
import { AppError } from './errors.js';
// Moved to ./formatting.ts, which has no discord.js dependency. Re-exported here
// so the existing imports from api/util.js keep working.
export { gameArt, nexusModsTrackingUrl, calcUptime } from './formatting.js';
export { Logger, logger } from './logger.js';

export const isTesting = process.env.NODE_ENV === 'testing';
// const isProduction = process.env.NODE_ENV === 'production';

export const baseheader: Readonly<Record<string, string>> = {
    'Application-Name': 'Nexus Mods Discord Bot',
    'Application-Version': process.env.npm_package_version || '0.0.0'
};

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

export async function autoCompleteGameID(client: ClientExt, acInteraction: AutocompleteInteraction, logger: Logger) {
    const focused = acInteraction.options.getFocused().toLowerCase();
    try {
        let games = await client.gamesList!.getGames();
        if (focused !== '') games = games.filter(g => (g.name.toLowerCase().startsWith(focused) || g.domain_name.includes(focused)));
        await acInteraction.respond(
            games.map(g => ({ name: g.name, value: g.id })).slice(0, 25)
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
        if (focused) modFilter.name = { value: focused, op: 'WILDCARD' };
        if (gameDomain) modFilter.gameDomainName = { value: gameDomain, op: 'EQUALS' };
        if (gameId) modFilter.gameId = { value: String(gameId), op: 'EQUALS' };
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

export async function autoCompleteModSearchIdOnly(acInteraction: AutocompleteInteraction, logger: Logger, gameDomain?: string, gameId?: number) {
    const focused = acInteraction.options.getFocused();
    if (focused.length < 3) return await acInteraction.respond([]);
    try {
        const user = new DiscordBotUser(DummyNexusModsUser, logger);
        const modFilter: IModsFilter = {};
        if (focused) modFilter.name = { value: focused, op: 'WILDCARD' };
        if (gameDomain) modFilter.gameDomainName = { value: gameDomain, op: 'EQUALS' };
        if (gameId) modFilter.gameId = { value: String(gameId), op: 'EQUALS' };
        const modSearch = await user.NexusMods.API.v2.Mods(
            modFilter,
            { endorsements: { direction: 'DESC' }}
        )
        await acInteraction.respond(
            modSearch.nodes.map(m => ({ name: `${m.name}`.substring(0, 99), value: m.modId }))
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

export const unexpectedErrorEmbed = (err: any, context: any, errorId?: string): EmbedBuilder => {
    // Only an AppError carries text written for a user. Everything else gets a generic
    // line plus a reference to quote, because an arbitrary err.message can contain
    // anything - that is how an access token once ended up rendered into an embed.
    const detail = err instanceof AppError
        ? err.userMessage
        : 'The bot hit an unexpected problem. The details have been recorded.';
    const operational = err instanceof AppError ? err.isOperational : false;
    return new EmbedBuilder()
    .setTitle('Unexpected error')
    .setColor('DarkRed')
    .setDescription(operational
        ? 'The bot hit a problem running this command. It is usually temporary - please try again in a few minutes.'
        : 'The bot encountered an unexpected error with this command. Please report it, quoting the reference below.')
    .addFields([
        {
            name: 'What happened', value: detail.substring(0, 1010)
        },
        {
            name: 'Reference', value: `\`${errorId ?? 'not recorded'}\``
        },
        {
            name: 'Context', value: `\`\`\`json\n${JSON.stringify(context, null, 2).substring(0, 1010)}\n\`\`\``
        },
        {
            name: 'Reporting the error', value: 'Please report this on [GitHub](https://github.com/Nexus-Mods/discord-bot/issues/) or the [Nexus Mods server](https://discord.gg/nexusmods).'
        }
    ])
}


/**
 * Generates a tracking URL with UTM parameters for Nexus Mods.
 *
 * @param {string} url - The base URL to which UTM parameters will be added.
 * @param {string} [content] - Optional content name to include in the `utm_content` parameter.
 * @param {Record<string, string>} [extraParams] - Optional additional parameters to include in the query string. E.g. Tab selection on the mod page.
 * @returns {string} The full URL with tracking parameters.
 */
export function modUidToGameAndModId(uid: bigint | string): { gameId: number, modId: number } {
    if (typeof uid === 'string') uid = BigInt(uid);
    const gameId = Number(uid >> BigInt(32)); // Use unsigned right shift (>>>)
    const modId = Number(uid & BigInt(0xFFFFFFFF));; // Bitwise AND with 0xFFFFFFFF (unsigned 32-bit mask)
    return { gameId, modId };
}

export function modIdAndGameIdToModUid(gameId: number, modId: number): string {
    // Convert the gameId and modId to BigInt
    const bigGameId = BigInt(gameId);
    const bigModId = BigInt(modId);
    // Perform the left shift operation and combine the values
    return ((bigGameId << BigInt(32)) + bigModId).toString();
}

export enum KnownDiscordServers {
    Main = '215154001799413770',
    BotDemo = '581095546291355649',
    Moderator = '268004475510325248',
    Author = '232168805038686208',
    App = '1134149061080002713'
}
