import type { StatusPageResponse, ModDownloadInfo } from '../types/responses.js';
import type { Logger } from '@nexusmods/core/logger.js';
import { logger } from '@nexusmods/core/logger.js';
import { NexusApiError } from '@nexusmods/core/errors.js';

export interface IGameStatic {
    approved_date: number;
    collections: number;
    domain_name: string;
    downloads: number;
    file_count: number;
    forum_url: string;
    genre: string;
    id: number;
    mods: number;
    name: string;
    name_lower: string;
    nexusmods_url: string;
}

interface ISiteStats {
    games_count: number;
    mods_count: number;
    files_count: number;
    authors_count: number;
    users_count: number;
    collections_count: number;
    downloads_count: number;
    unique_downloads_count: number;
    updated_at: Date;
}

const staticGamesList = 'https://data.nexusmods.com/file/nexus-data/games.json';
const staticStatsList = 'https://data.nexusmods.com/file/nexus-data/site-stats.json';
const nexusStatsAPI: string = 'https://staticstats.nexusmods.com/live_download_counts/mods/'; //for getting stats by game.
const nexusModsStatus: string = 'https://nexusmods.statuspage.io/api/v2/status.json';
const nexusModsFullStatus: string = 'https://nexusmods.statuspage.io/api/v2/summary.json';

export async function Games(headers: Record<string, string>): Promise<IGameStatic[]> {
    try {
        const res = await fetch(staticGamesList, { 
            headers: {
            'Application-Name': headers['Application-Name'] , 
            'Application-Version': headers['Application-Version'] 
            } 
        });
        if (!res.ok) throw new Error(`${res.status} - ${res.statusText}`);
        const gameList = await res.json();
        return gameList as IGameStatic[];
    }
    catch(err) {
        logger.error('Error getting games list from static file', err, true);
        throw new NexusApiError('Could not fetch the static games list', {
            cause: err instanceof Error ? err : new Error(String(err)),
            userMessage: 'Nexus Mods could not be reached. Please try again shortly.',
        });
    }
}

export async function SiteStats(headers: Record<string, string>): Promise<ISiteStats> {
    try {
        const res = await fetch(staticStatsList, { 
            headers: {
            'Application-Name': headers['Application-Name'] , 
            'Application-Version': headers['Application-Version'] 
            } 
        });
        if (!res.ok) throw new Error(`${res.status} - ${res.statusText}`);
        const siteStats = await res.json() as ISiteStats;
        if (typeof(siteStats.updated_at) === 'string') siteStats.updated_at = new Date(siteStats.updated_at);
        return siteStats as ISiteStats;
    }
    catch(err) {
        logger.error('Error getting games list from static file', err, true);
        throw new NexusApiError('Could not fetch the static site stats', {
            cause: err instanceof Error ? err : new Error(String(err)),
            userMessage: 'Nexus Mods could not be reached. Please try again shortly.',
        });
    }
}

class downloadStatsCache {
    private downloadStats: { [gameId: number]: { data: ModDownloadInfo[], expires: Date } };
    private cacheExpiryTime: number;
    
    constructor() {
        this.downloadStats = {};
        this.cacheExpiryTime = (5*60*1000);
    }

    saveGameStats(id: number, data: ModDownloadInfo[]) {
        const expires = new Date(new Date().getTime() + this.cacheExpiryTime);
        this.downloadStats[id] = { data, expires };
    }

    getStats(gameId: number, modId?: number): ModDownloadInfo[] | ModDownloadInfo | undefined {
        const game = this.downloadStats[gameId];
        // If nothing in the cache
        if (!game) return undefined;
        // Check if it has expired
        if (!!game && game.expires < new Date()) {
            delete this.downloadStats[gameId];
            logger.info('Clearing cached download stats for Game ID:', gameId);
            return undefined;
        }
        // If there's no game data or mod ID return whatever we found.
        if (modId === -1) return game.data;

        // Find the mod.
        const mod = game.data.find(m => m.id === modId);
        return mod || ({ id: modId, unique_downloads: 0, total_downloads: 0 } as ModDownloadInfo);
    }

    cleanUp() {
        // Clear out old cache entries
        const startSize = JSON.stringify(this.downloadStats).length;
        // logMessage('Clearing up download stats cache', { size: JSON.stringify(this.downloadStats).length });
        Object.entries(this.downloadStats)
        .map(([key, entry]: [string, { data: ModDownloadInfo[], expires: Date }]) => {
            const id: number = parseInt(key);
            if (entry.expires < new Date()) {
                logger.info('Removing expired cache data for game ', id);
                delete this.downloadStats[id]
            };
        });
        const endSize = JSON.stringify(this.downloadStats).length;
        const change = endSize - startSize;
        if (startSize !== endSize) logger.info('Clean up of download stats cache done', { change });
    }
}

const downloadCache = new downloadStatsCache();

export async function ModDownloads(gameId: number = -1, modId: number = -1): Promise<ModDownloadInfo | ModDownloadInfo[]> {
    try {
        // Check for a cached version of the stats
        const cachedValue = downloadCache.getStats(gameId, modId);
        if (cachedValue) {
            downloadCache.cleanUp();
            return cachedValue;
        }
        // Get stats CSV
        const url = new URL(`${gameId}.csv`, nexusStatsAPI);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} - ${res.statusText}`);
        const statsCsv = await res.text();
        // Map into an object
        const gameStats: ModDownloadInfo[] = statsCsv.split(/\n/).map(
            (row: string) => {
                if (row === '') return;
                const values = row.split(',');
                if (values.length !== 4) {
                    // Since 2021-04-28 the CSV now includes page views as the 4th value.
                    logger.warn(`Invalid CSV row for Game (${gameId}): ${row}`);
                    return;
                }
                return {
                    id: parseInt(values[0]),
                    total_downloads: parseInt(values[1]),
                    unique_downloads: parseInt(values[2])
                }
            }
        ).filter((info: ModDownloadInfo | undefined) => info !== undefined);

        // Save to cache
        downloadCache.saveGameStats(gameId, gameStats);
        downloadCache.cleanUp();
        return downloadCache.getStats(gameId, modId) || { id: modId, total_downloads: 0, unique_downloads: 0 };
    }
    catch(err) {
        throw new NexusApiError('Could not retrieve mod download data.', {
            cause: err,
            context: { gameId, modId },
        });
    }
}

export async function WebsiteStatus<B extends boolean>(headers: Record<string, string>, logger: Logger, full: B): Promise <StatusPageResponse<B>> {
    try {
        const url = full ? nexusModsFullStatus : nexusModsStatus;
        const res = await fetch(url, { headers: {
            'Application-Name': headers['Application-Name'] , 
            'Application-Version': headers['Application-Version'] 
        } });
        if (!res.ok) throw new Error(`${res.status} - ${res.statusText}`);
        const statusPageResponse = await res.json()
        return statusPageResponse as StatusPageResponse<B>
    }
    catch(err) {
        logger.error('Error getting website status from statuspage.io', err, true);
        throw new NexusApiError('Could not fetch the website status', {
            cause: err instanceof Error ? err : new Error(String(err)),
            userMessage: 'statuspage.io could not be reached. Please try again shortly.',
        });
    }
}