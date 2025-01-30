import axios, { AxiosError } from 'axios';
import { StatusPageResponse, ModDownloadInfo } from '../../types/util';
import { logMessage } from '../util';

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
        const gameList = await axios({
            url: staticGamesList,
            transformResponse: (res) => JSON.parse(res),
            headers: { 
                'Application-Name': headers['Application-Name'] , 
                'Application-Version': headers['Application-Version'] 
            },
        });
        return gameList.data as IGameStatic[];
    }
    catch(err) {
        logMessage('Error getting games list from static file', err, true);
        return [];
    }
}

export async function SiteStats(headers: Record<string, string>): Promise<ISiteStats> {
    try {
        const stats: ISiteStats = await axios({
            url: staticStatsList,
            transformResponse: (res) => {
                const parsed = JSON.parse(res);
                if (typeof(parsed.updated_at) === 'string') parsed.updated_at = new Date(parsed.updated_at);
                return (parsed as ISiteStats)
            },
            headers: { 
                'Application-Name': headers['Application-Name'] , 
                'Application-Version': headers['Application-Version'] 
            },
        });
        return stats;
    }
    catch(err) {
        logMessage('Error getting games list from static file', err, true);
        (err as AxiosError).message = `Error getting site stats from static file: ${(err as AxiosError).message}`;
        throw err;
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
            logMessage('Clearing cached download stats for Game ID:', gameId);
            return undefined;
        }
        // If there's no game data or mod ID return whatever we found.
        if (modId == -1) return game.data;

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
                logMessage('Removing expired cache data for game ', id);
                delete this.downloadStats[id]
            };
        });
        const endSize = JSON.stringify(this.downloadStats).length;
        const change = endSize - startSize;
        if (startSize != endSize) logMessage('Clean up of download stats cache done', { change });
    }
}

const downloadCache = new downloadStatsCache();

export async function ModDownloads(gameId: number = -1, modId: number = -1): Promise<ModDownloadInfo | ModDownloadInfo[]> {
    try {
        // Check for a cached version of the stats
        const cachedValue = downloadCache.getStats(gameId, modId);
        if (!!cachedValue) {
            downloadCache.cleanUp();
            return cachedValue;
        }
        // Get stats CSV
        const statsCsv = await axios({ baseURL: nexusStatsAPI, url: `${gameId}.csv`, responseEncoding: 'utf8' }); //({ url: `${nexusStatsAPI}${gameId}.csv`, encoding: 'utf8' });
        // const statsCsv = await requestPromise({ url: `${nexusStatsAPI}${gameId}.csv`, encoding: 'utf8' });
        // Map into an object
        const gameStats: ModDownloadInfo[] = statsCsv.data.split(/\n/).map(
            (row: string) => {
                if (row === '') return;
                const values = row.split(',');
                if (values.length != 4) {
                    // Since 2021-04-28 the CSV now includes page views as the 4th value.
                    logMessage(`Invalid CSV row for Game (${gameId}): ${row}`);
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
        return Promise.reject(`Could not retrieve download data for Game (${gameId}) ${modId} \n ${err}`);
    }
}

export async function WebsiteStatus<B>(headers: Record<string, string>, full: B): Promise <StatusPageResponse<B>> {
    try {
        const response = await axios({
            url: full ? nexusModsFullStatus : nexusModsStatus,
            transformResponse: (res) => JSON.parse(res),
            headers,
        });
        return response.data as StatusPageResponse<B>;
    }
    catch(err) {
        logMessage('Error fetching Nexus Mods status page data', err, true);
        throw err;
    }
}