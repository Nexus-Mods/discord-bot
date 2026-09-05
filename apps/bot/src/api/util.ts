import { BOT_VERSION } from '../version.js';
export { gameArt, nexusModsTrackingUrl, calcUptime } from '@nexusmods/core/formatting.js';

export const isTesting = process.env.NODE_ENV === 'testing';
// const isProduction = process.env.NODE_ENV === 'production';

export const baseheader: Readonly<Record<string, string>> = {
    'Application-Name': 'Nexus Mods Discord Bot',
    'Application-Version': BOT_VERSION
};


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

/**
 * The inverse of modUidToGameAndModId. Kept deliberately: it has no caller today, but a
 * decoder without its encoder is half a pair, and the v2 API takes mod UIDs wherever it
 * returns them.
 */
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
