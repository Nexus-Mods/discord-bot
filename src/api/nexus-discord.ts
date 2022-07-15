//Commands for interacting with the Nexus Mods API. 
import requestPromise from 'request-promise-native'; //For making API requests
import { request, gql } from 'graphql-request'; // For interacting with API v2.
import { NexusUser } from '../types/users';
import { IGameListEntry, IValidateKeyResponse, IModInfo, IModFiles, IUpdateEntry, IChangelogs, IGameInfo } from '@nexusmods/nexus-api'
import { ModDownloadInfo, NexusSearchResult } from '../types/util';
import { logMessage } from './util';

const nexusAPI: string = 'https://api.nexusmods.com/'; //for all regular API functions
const nexusGraphAPI: string = nexusAPI+'/v2/graphql';
const nexusSearchAPI: string ='https://search.nexusmods.com/mods'; //for quicksearching mods
const nexusStatsAPI: string = 'https://staticstats.nexusmods.com/live_download_counts/mods/'; //for getting stats by game.
const requestHeader = {
    'Application-Name': 'Nexus Mods Discord Bot',
    'Application-Version': process.env.npm_package_version,
    'apikey': '' 
};

// Pass the user so we can grab their API key

async function games(user: NexusUser, bUnapproved?: boolean): Promise<IGameInfo[]>  {
    const apiKey: string = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    // If we have cached the games recently.
    requestHeader.apikey = apiKey;
    try {
        const gameList = await requestPromise({url: `${nexusAPI}v1/games`, headers: requestHeader, qs: { include_unapproved: bUnapproved }});
        const gamesParsed = JSON.parse(gameList);
        return gamesParsed;
    }
    catch(err) {
        return Promise.reject(`Nexus Mods API responded with ${(err as any).statusCode} while fetching all games. Please try again later.`);
    }

}

async function gameInfo(user: NexusUser, domainQuery: string): Promise<IGameListEntry> {
    const apiKey = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    requestHeader.apikey = apiKey;

    try {
        const game = await requestPromise({ url: `${nexusAPI}v1/games/${domainQuery}`, headers: requestHeader });
        const gameInfo: IGameListEntry = JSON.parse(game);
        return gameInfo;        
    }
    catch(err) {
        if ((err as any).statusCode === 404) return Promise.reject(`${(err as any).statusCode} - Game ${domainQuery} not found`);
        return Promise.reject(`API Error(gameInfo): Nexus Mods API responded with ${(err as any).statusCode}.`)
    }
}

export interface IValidateResponse extends IValidateKeyResponse {
    is_ModAuthor: boolean;
}

async function validate(apiKey: string): Promise<IValidateResponse> {
    requestHeader.apikey = apiKey;
    
    try {
        const validate: IValidateKeyResponse = JSON.parse(await requestPromise({ url: `${nexusAPI}v1/users/validate.json`, headers: requestHeader }));
        const is_ModAuthor: boolean = await getModAuthor(validate.user_id);
        return {is_ModAuthor, ...validate};
    }
    catch(err) {
        return Promise.reject(`${(err as any).name} : ${(err as Error).message}`);
    }
}

async function getModAuthor(id: number): Promise<boolean> {
    const query = gql`
    query getModAuthorStatus($id: Int!) {
        user(id: $id) {
            name
            recognizedAuthor
        }
    }`;

    const variables = { id  }
    
    try {
        const data = await request(nexusGraphAPI, query, variables);
        return data?.user?.recognizedAuthor;
    }
    catch(err) {
        logMessage('GraphQL request for mod author status failed', err, true);
        return false;
    }
}

async function quicksearch(query: string, bIncludeAdult: boolean, game_id: number = 0): Promise<NexusSearchResult> {
    query = query.split(' ').toString();//query.replace(/[^A-Za-z0-9\s]/gi, '').split(' ').join(',');
    try {
        const searchQuery = await requestPromise({ url: nexusSearchAPI, qs: { terms: encodeURI(query), game_id, include_adult: bIncludeAdult }, timeout: 15000 });
        let results = JSON.parse(searchQuery);
        results.fullSearchURL = `https://www.nexusmods.com/search/?RH_ModList=nav:true,home:false,type:0,user_id:0,game_id:${game_id},advfilt:true,search%5Bfilename%5D:${query.split(',').join('+')},include_adult:${bIncludeAdult},page_size:20,show_game_filter:true`;
        return results;
    }
    catch(err) {
        if ((err as Error).message.toLowerCase().includes('cloudflare')) return Promise.reject(new Error('Cloudflare error: Quicksearch request timed out.'));
        return Promise.reject(new Error(`Nexus Mods Search API responded with ${(err as any).statusCode} while fetching results. Please try again later.`));
    }
}

async function updatedMods(user: NexusUser, gameDomain: string, period: string = '1d'): Promise<IUpdateEntry[]> {
    const apiKey = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    requestHeader.apikey = apiKey;

    try {
        const updatedMods = await requestPromise({url: `${nexusAPI}v1/games/${gameDomain}/mods/updated.json`, headers: requestHeader, qs: {period: period}});
        return JSON.parse(updatedMods);
    }
    catch(err) {
        return Promise.reject(`API Error(updateMods): Nexus Mods API responded with ${(err as any).statusCode}. ${(err as Error).message}`);
    }
}

async function modInfo(user: NexusUser, gameDomain: string, modId: number): Promise<IModInfo> {
    const apiKey = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    requestHeader.apikey = apiKey;

    try {
        const modInfo = await requestPromise({url: `${nexusAPI}v1/games/${gameDomain}/mods/${modId}.json`, headers: requestHeader});
        return JSON.parse(modInfo);
    }
    catch(err) {
        return Promise.reject(`API Error(modInfo): Nexus Mods API responded with ${(err as any).statusCode}. ${(err as Error).message}`);
    }
}

async function modFiles(user: NexusUser, gameDomain: string, modId: number): Promise<IModFiles> {
    const apiKey = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    requestHeader.apikey = apiKey;

    try {
        const modFiles = await requestPromise({url: `${nexusAPI}v1/games/${gameDomain}/mods/${modId}/files.json`, headers: requestHeader});
        return JSON.parse(modFiles);
    }
    catch(err) {
        return Promise.reject(`API Error (modFiles): Nexus Mods API responded with ${(err as any).statusCode}. ${(err as Error).message}`);
    }

}

async function modChangelogs(user: NexusUser, gameDomain: string, modId: number): Promise<IChangelogs> {
    const apiKey = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    requestHeader.apikey = apiKey;

    try {
        const modChangelogs = await requestPromise({url: `${nexusAPI}v1/games/${gameDomain}/mods/${modId}/changelogs.json`, headers: requestHeader});
        return JSON.parse(modChangelogs);
    }
    catch(err) {
        return Promise.reject(`API Error(modChangelogs): Nexus Mods API responded with ${(err as any).statusCode}. ${(err as Error).message}`);
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
        logMessage('Clearing up download stats cache', { size: JSON.stringify(this.downloadStats).length });
        Object.entries(this.downloadStats)
        .map(([key, entry]: [string, { data: ModDownloadInfo[], expires: Date }]) => {
            const id: number = parseInt(key);
            if (entry.expires < new Date()) {
                logMessage('Removing expired cache data for game ', id);
                delete this.downloadStats[id]
            };
        });
        logMessage('Clean up of download stats cache done', { newSize: JSON.stringify(this.downloadStats).length });
    }
}

const downloadCache = new downloadStatsCache();

async function getDownloads(user: NexusUser, gameDomain: string, gameId: number = -1, modId: number = -1): Promise<ModDownloadInfo | ModDownloadInfo[]> {
    try {
        const gameList: IGameListEntry[] = await games(user, false);
        const game: IGameListEntry | undefined = gameList.find(game => (gameId !== -1 && game.id === gameId) || (gameDomain === game.domain_name));
        if (!game) return Promise.reject(`Unable to resolve game for ${gameId}, ${gameDomain}`);
        gameId = game.id;
        // Check for a cached version of the stats
        const cachedValue = downloadCache.getStats(gameId, modId);
        if (!!cachedValue) {
            downloadCache.cleanUp();
            return cachedValue;
        }
        // Get stats CSV
        const statsCsv = await requestPromise({ url: `${nexusStatsAPI}${gameId}.csv`, encoding: 'utf8' });
        // Map into an object
        const gameStats: ModDownloadInfo[] = statsCsv.split(/\n/).map(
            (row: string) => {
                if (row === '') return;
                const values = row.split(',');
                if (values.length != 4) {
                    // Since 2021-04-28 the CSV now includes page views as the 4th value.
                    logMessage(`Invalid CSV row for ${game.domain_name} (${gameId}): ${row}`);
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
        return Promise.reject(`Could not retrieve download data for ${gameDomain} (${gameId}) ${modId} \n ${err}`);
    }
}

export { games, gameInfo, validate, quicksearch, updatedMods, modInfo, modFiles, modChangelogs, getDownloads };