import { AutocompleteInteraction, EmbedBuilder } from "discord.js";
import { ClientExt } from "../types/DiscordTypes";
import { DiscordBotUser, DummyNexusModsUser } from "./DiscordBotUser";
import { IModsFilter } from "./queries/v2";
import { ICollectionsFilter } from "../types/GQLTypes";

export const isTesting = process.env.NODE_ENV === 'testing';
const isProduction = process.env.NODE_ENV === 'production';

export const baseheader: Readonly<Record<string, string>> = {
    'Application-Name': 'Nexus Mods Discord Bot',
    'Application-Version': process.env.npm_package_version || '0.0.0'
};

type GameArtType = '4_3' | '2_3' | 'hero' | 'icon';

export const gameArt = (id: number, type?: GameArtType) : string => {
    switch (type) {
        case '4_3':
            return `https://images.nexusmods.com/images/games/4_3/tile_${id}.jpg`;
        case '2_3':
            return `https://images.nexusmods.com/images/games/v2/${id}/tile.jpg`;
        case 'hero' : 
            return `https://images.nexusmods.com/images/games/v2/${id}/hero.jpg`;
        case 'icon' : 
            return `https://images.nexusmods.com/images/games/v2/${id}/thumbnail.jpg`;
        default:
            return `https://images.nexusmods.com/images/games/4_3/tile_${id}.jpg`;
    }
}

const colors = [
    '\x1b[32m', // Green
    '\x1b[34m', // Blue
    '\x1b[35m', // Magenta
    '\x1b[90m', // Bright Black (Gray)
    '\x1b[92m', // Bright Green
    '\x1b[93m', // Bright Yellow
    '\x1b[94m', // Bright Blue
    '\x1b[95m', // Bright Magenta
    '\x1b[96m', // Bright Cyan
];

export class Logger {
    private shardId: string;
    private shardColor: string;

    constructor(shardId: string) {
        this.shardId = shardId;
        this.shardColor = shardId === 'Main' ? '\x1b[0m' : colors[parseInt(this.shardId) % colors.length]
    }
    public setShardId(shardId: string) {
        this.shardId = shardId;
        this.shardColor = shardId === 'Main' ? '\x1b[0m' : colors[parseInt(this.shardId) % colors.length]
    }

    private prefix(colourCode: string = '\x1b[0m'): string {
        if (this.shardId === 'Main') return `${colourCode}${new Date().toLocaleString()} - `;
        return `${new Date().toLocaleString()} - ${this.shardColor}[Shard ${this.shardId}]${colourCode}`;
    }

    public info(message: string, data?: any) {
        const formatted = `${this.prefix()} ${message}`;
        data ? console.log(formatted, data) : console.log(formatted);
    }
    public error(message: string, data?: any, ...args: any[]) {
        const formatted = `${this.prefix('\x1b[31m')} ${message}\x1b[0m`;
        data ? console.error(formatted, data) : console.error(formatted);
    }
    public warn(message: string, data?: any, ...args: any[]) {
        const formatted = `${this.prefix('\x1b[33m')} ${message}\x1b[0m`;
        data ? console.warn(formatted, data) : console.warn(formatted);
    }
    public debug(message: string, data?: any) {
        if (isTesting === false) return; // Don't log debug messages in production
        const formatted = `${this.prefix('\x1b[36m')} ${message}\x1b[0m`;
        data ? console.debug(formatted, data) : console.debug(formatted);
    }
}

export async function autocompleteGameName(client: ClientExt, acInteraction: AutocompleteInteraction, logger: Logger) {
    const focused = acInteraction.options.getFocused().toLowerCase();
    try {
        var games = await client.gamesList!.getGames();
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

export async function autoCompleteModSearch(acInteraction: AutocompleteInteraction, logger: Logger, gameDomain?: string) {
    const focused = acInteraction.options.getFocused();
    if (focused.length < 3) return await acInteraction.respond([]);
    try {
        const user = new DiscordBotUser(DummyNexusModsUser, logger);
        const modFilter: IModsFilter = {};
        if (focused) modFilter.name = { value: focused, op: 'WILDCARD' };
        if (gameDomain) modFilter.gameDomainName = { value: gameDomain, op: 'EQUALS' };
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

export const unexpectedErrorEmbed = (err: any, context: any): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle('Unexpected error')
    .setColor('DarkRed')
    .setDescription('The bot encountered an unexpected error with this command. You may be able to retry after a few minutes. If this issue persists, please report it including the information below.')
    .addFields([
        { 
            name: 'Error Details', value: `\`\`\`${err.message || err}\`\`\``.substring(0,1010)
        },
        {
            name: 'Error Context', value: `\`\`\`json\n${JSON.stringify(context, null, 2).substring(0,1010)}\n\`\`\``
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
export const nexusModsTrackingUrl = (url: string, content?: string, extraParams?: Record<string,string>): string => {
    const source = 'DiscordBot';
    const params = new URLSearchParams(extraParams);
    params.append('utm_source', formatTrackingTag(source));
    params.append('utm_medium', formatTrackingTag('app'));
    if (content) params.append('utm_content', formatTrackingTag(content));
    
    return new URL(`${url}?${params.toString()}`).toString();
}

function formatTrackingTag(input: string): string {
    return input.toLowerCase().replaceAll(' ', '_');
}

function modUidToGameAndModId(uid: bigint | string): { gameId: number, modId: number } {
    if (typeof uid === 'string') uid = BigInt(uid);
    const gameId = Number(uid >> BigInt(32)); // Use unsigned right shift (>>>)
    const modId = Number(uid & BigInt(0xFFFFFFFF));; // Bitwise AND with 0xFFFFFFFF (unsigned 32-bit mask)
    console.log('Parsed IDs', { uid, gameId, modId });
    return { gameId, modId };
}

function modIdAndGameIdToModUid(gameId: number, modId: number): string {
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

/**
 * Generates a string representation of the uptime value.
 * @param {number} seconds - The number of seconds to convert into a string
 * @returns {string} - Returns the uptime as a string. e.g. "1d 4h 10m 30s"
 */

export function calcUptime(seconds: number): string {
    const days = Math.floor(seconds/86400);
    seconds -= (days * 86400);
    const hours = Math.floor(seconds/3600);
    seconds -= (hours * 3600);
    const minutes = Math.floor(seconds/60);
    seconds -= (minutes * 60);
    return `${days}d ${hours}h ${minutes}m ${seconds.toFixed()}s`;
}