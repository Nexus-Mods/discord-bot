//Commands for interacting with the Nexus Mods API. 
import requestPromise from 'request-promise-native'; //For making API requests
import { NexusUser } from '../types/users';
import { IGameListEntry, IValidateKeyResponse, IModInfo, IModFiles, IUpdateEntry, IChangelogs, IGameInfo } from '@nexusmods/nexus-api'
import { ModDownloadInfo, NexusSearchResult } from '../types/util';

const nexusAPI: string = 'https://api.nexusmods.com/'; //for all regular API functions
const nexusSearchAPI: string ='https://search.nexusmods.com/mods'; //for quicksearching mods
const nexusStatsAPI: string = 'https://staticstats.nexusmods.com/live_download_counts/mods/'; //for getting stats by game.
const requestHeader = {
    'Application-Name': 'Nexus Mods Discord Bot',
    'Application-Version': process.env.npm_package_version,
    'apikey': '' 
};

const cachePeriod: number = (5*60*1000);

// Pass the user so we can grab their API key

let cachedGames : { update: number, games: IGameInfo[], unapproved: boolean }; //cache the game list for 5 mins.

async function games(user: NexusUser, bUnapproved?: boolean): Promise<IGameInfo[]>  {
    const apiKey: string = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    // If we have cached the games recently.
    const useCache = (bUnapproved === cachedGames?.unapproved || !bUnapproved)
    if (useCache && cachedGames && cachedGames.update > new Date().getTime()) return Promise.resolve(cachedGames.games);
    requestHeader.apikey = apiKey;
    try {
        const gameList = await requestPromise({url: `${nexusAPI}v1/games`, headers: requestHeader, qs: { include_unapproved: bUnapproved }});
        cachedGames = { games: JSON.parse(gameList), update: new Date().getTime() + cachePeriod, unapproved: (bUnapproved === true) };
        return cachedGames.games;
    }
    catch(err) {
        return Promise.reject(`Nexus Mods API responded with ${err.statusCode} while fetching all games. Please try again later.`);
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
        if (err.statusCode === 404) return Promise.reject(`${err.statusCode} - Game ${domainQuery} not found`);
        return Promise.reject(`API Error(gameInfo): Nexus Mods API responded with ${err.statusCode}.`)
    }
}

async function validate(apiKey: string): Promise<IValidateKeyResponse> {
    requestHeader.apikey = apiKey;
    
    try {
        const validate: IValidateKeyResponse = JSON.parse(await requestPromise({ url: `${nexusAPI}v1/users/validate.json`, headers: requestHeader }));
        return validate;
    }
    catch(err) {
        return Promise.reject(`${err.name} : ${err.message}`);
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
        if (err.message.toLowerCase().includes('cloudflare')) return Promise.reject(new Error('Cloudflare error: Quicksearch request timed out.'));
        return Promise.reject(new Error(`Nexus Mods Search API responded with ${err.statusCode} while fetching results. Please try again later.`));
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
        return Promise.reject(`API Error(updateMods): Nexus Mods API responded with ${err.statusCode}. ${err.message}`);
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
        return Promise.reject(`API Error(modInfo): Nexus Mods API responded with ${err.statusCode}. ${err.message}`);
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
        return Promise.reject(`API Error (modFiles): Nexus Mods API responded with ${err.statusCode}. ${err.message}`);
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
        return Promise.reject(`API Error(modChangelogs): Nexus Mods API responded with ${err.statusCode}. ${err.message}`);
    }

}

let dlCache: { [id: number]: { data: ModDownloadInfo[], expires: Date } } = {};
const dlCacheExp: number = (5*60*1000);

async function getDownloads(user: NexusUser, gameDomain: string, gameId: number = -1, modId: number = -1): Promise<ModDownloadInfo | ModDownloadInfo[]> {
    try {
        const gameList: IGameListEntry[] = await games(user, false);
        const game: IGameListEntry | undefined = gameList.find(game => (gameId !== -1 && game.id === gameId) || (gameDomain === game.domain_name));
        if (!game) return Promise.reject(`Unable to resolve game for ${gameId}, ${gameDomain}`);
        gameId = game.id;
        // Check for a cached version of the stats
        if (dlCache[gameId] && dlCache[gameId].expires > new Date()) {
            // console.log('Using cached download value for game '+game.name, modId, dlCache[gameId].expires);
            if (modId == -1) return dlCache[gameId].data;
            else return dlCache[gameId].data.find(m => m.id === modId) || {id: modId, unique_downloads: 0, total_downloads: 0};
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
                    console.log(`Invalid CSV row for ${game.domain_name} (${gameId}): ${row}`);
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
        dlCache[gameId] = { data: gameStats, expires: new Date(new Date().getTime() + dlCacheExp) };
        // console.log('Cached download stats', game.name, dlCache[gameId].expires);

        // Get info for the mod, if we're looking for it.
        if (modId !== -1) {
            const modInfo: ModDownloadInfo | undefined = gameStats.find((info: ModDownloadInfo) => info.id === modId);
            return modInfo || { id: modId, total_downloads: 0, unique_downloads: 0 };
        }
        else return gameStats;
    }
    catch(err) {
        return Promise.reject(`Could not retrieve download data for ${gameDomain} (${gameId}) ${modId} \n ${err}`)
    }
}

export { games, gameInfo, validate, quicksearch, updatedMods, modInfo, modFiles, modChangelogs, getDownloads };