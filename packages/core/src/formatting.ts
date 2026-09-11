/**
 * Formatting and URL helpers with no discord.js dependency.
 *
 * These lived in api/util.ts, which imports discord.js and most of the API layer, so
 * a unit test for calcUptime pulled about fifteen seconds of module loading with it.
 * Splitting them out keeps them cheap to test and honest about what they need.
 */

type GameArtType = '4_3' | '2_3' | 'hero' | 'icon';

export const gameArt = (id: number, type?: GameArtType): string => {
    switch (type) {
        case '4_3':
            return `https://images.nexusmods.com/images/games/4_3/tile_${id}.jpg`;
        case '2_3':
            return `https://images.nexusmods.com/images/games/v2/${id}/tile.jpg`;
        case 'hero':
            return `https://images.nexusmods.com/images/games/v2/${id}/hero.jpg`;
        case 'icon':
            return `https://images.nexusmods.com/images/games/v2/${id}/thumbnail.jpg`;
        default:
            return `https://images.nexusmods.com/images/games/4_3/tile_${id}.jpg`;
    }
}

export const nexusModsTrackingUrl = (url: string, content?: string, extraParams?: Record<string, string>): string => {
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

/**
 * Generates a string representation of the uptime value.
 * @param {number} seconds - The number of seconds to convert into a string
 * @returns {string} - Returns the uptime as a string. e.g. "1d 4h 10m 30s"
 */
export function calcUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    seconds -= (days * 86400);
    const hours = Math.floor(seconds / 3600);
    seconds -= (hours * 3600);
    const minutes = Math.floor(seconds / 60);
    seconds -= (minutes * 60);
    return `${days}d ${hours}h ${minutes}m ${seconds.toFixed()}s`;
}
