//Commands for interacting with the Nexus Mods API. 
import requestPromise from 'request-promise-native'; //For making API requests
import { NexusUser } from '../types/users';
import { IGameListEntry, IValidateKeyResponse, IModInfo, IModFiles, IUpdateEntry, IChangelogs, IGameInfo } from '@nexusmods/nexus-api'
import { ModDownloadInfo } from '../types/util';

const nexusAPI: string = 'https://api.nexusmods.com/'; //for all regular API functions
const nexusSearchAPI: string ='https://search.nexusmods.com/mods'; //for quicksearching mods
const nexusStatsAPI: string = 'https://staticstats.nexusmods.com/live_download_counts/mods/'; //for getting stats by game.
const requestHeader = {
    'Application-Name': 'Nexus Mods Discord Bot',
    'Application-Version': 2.0,
    'apikey': '' 
};

const cachePeriod: number = (5*60*1000);

// Pass the user so we can grab their API key

let cachedGames : { update: number, games: IGameInfo[] }; //cache the game list for 5 mins.

async function games(user: NexusUser, bUnapproved: boolean): Promise<IGameInfo[]>  {
    const apiKey: string = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    // If we have cached the games recently.
    if (cachedGames && cachedGames.update > new Date().getTime()) return Promise.resolve(cachedGames.games);
    requestHeader.apikey = apiKey;
    try {
        const gameList = await requestPromise({url: `${nexusAPI}v1/games`, headers: requestHeader, qs: { include_unapproved: bUnapproved }});
        cachedGames = { games: JSON.parse(gameList), update: new Date().getTime() + cachePeriod };
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
        return Promise.reject(`API Error: Nexus Mods API responded with ${err.statusCode}.`)
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

async function quicksearch(query: string, bIncludeAdult: boolean, gameId: number): Promise<any> {
    query = query.replace(/[^A-Za-z0-9\s]/gi, '').split(' ').join(',');
    try {
        const searchQuery = await requestPromise({ url: nexusSearchAPI, qs: { terms: encodeURI(query), game_id: gameId, include_adult: bIncludeAdult }, timeout: 15000 });
        let results = JSON.parse(searchQuery);
        results.fullSearchURL = `https://www.nexusmods.com/search/?RH_ModList=nav:true,home:false,type:0,user_id:0,game_id:${gameId},advfilt:true,search%5Bfilename%5D:${query.split(',').join('+')},include_adult:${bIncludeAdult},page_size:20,show_game_filter:true`;
        return results;
    }
    catch(err) {
        if (err.message.toLowerCase().includes('cloudflare')) return Promise.reject('Cloudflare error: Quicksearch request timed out.');
        return Promise.reject(`Nexus Mods Search API responded with ${err.statusCode} while fetching results. Please try again later.`);
    }
}

async function updatedMods(user: NexusUser, gameDomain: string, period: string = '1d'): Promise<IUpdateEntry[]> {
    const apiKey = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    requestHeader.apikey = apiKey;

    try {
        const updatedMods = await requestPromise({url: `${nexusAPI}v1/games/${gameDomain}'/mods/updated.json`, headers: requestHeader, qs: {period: period}});
        return JSON.parse(updatedMods);
    }
    catch(err) {
        return Promise.reject(`API Error: Nexus Mods API responded with ${err.statusCode}. ${err.message}`);
    }
}

async function modInfo(user: NexusUser, gameDomain: string, modId: number): Promise<IModInfo> {
    const apiKey = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    requestHeader.apikey = apiKey;

    try {
        const modInfo = await requestPromise({url: `${nexusAPI}v1/games/${gameDomain}'/mods/${modId}.json`, headers: requestHeader});
        return JSON.parse(modInfo);
    }
    catch(err) {
        return Promise.reject(`API Error: Nexus Mods API responded with ${err.statusCode}. ${err.message}`);
    }
}

async function modFiles(user: NexusUser, gameDomain: string, modId: number): Promise<IModFiles> {
    const apiKey = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    requestHeader.apikey = apiKey;

    try {
        const modFiles = await requestPromise({url: `${nexusAPI}v1/games/${gameDomain}'/mods/${modId}/files.json`, headers: requestHeader});
        return JSON.parse(modFiles);
    }
    catch(err) {
        return Promise.reject(`API Error: Nexus Mods API responded with ${err.statusCode}. ${err.message}`);
    }

}

async function modChangelogs(user: NexusUser, gameDomain: string, modId: number): Promise<IChangelogs> {
    const apiKey = user.apikey;
    if (!apiKey) Promise.reject('API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.');

    requestHeader.apikey = apiKey;

    try {
        const modChangelogs = await requestPromise({url: `${nexusAPI}v1/games/${gameDomain}'/mods/${modId}/changelogs.json`, headers: requestHeader});
        return JSON.parse(modChangelogs);
    }
    catch(err) {
        return Promise.reject(`API Error: Nexus Mods API responded with ${err.statusCode}. ${err.message}`);
    }

}

async function getDownloads(user: NexusUser, gameDomain: string, gameId: number = -1, modId: number = -1): Promise<ModDownloadInfo | ModDownloadInfo[]> {
    try {
        const gameList: IGameListEntry[] = await games(user, false);
        const game: IGameListEntry | undefined = gameList.find(game => (gameId !== -1 && game.id === gameId) || (game.domain_name === game.domain_name));
        if (!game) return Promise.reject(`Unable to resolve game for ${gameId}, ${gameDomain}`);
        gameId = game.id;
        // Get stats CSV
        const statsCsv = await requestPromise({ url: `${nexusStatsAPI}${gameId}`, encoding: 'utf8' });
        // Map into an object
        const gameStats: ModDownloadInfo[] = statsCsv.split(/\n/).map(
            (row: string) => {
                if (row !== '') return;
                const values = row.split(',');
                if (values.length !=3) {
                    console.log(`Invalid CSV row for ${game.domain_name} (${gameId}): ${row}`);
                    return;
                }
                return {
                    id: parseInt(row[0]),
                    total_downloads: parseInt(row[1]),
                    unique_downloads: parseInt(row[3])
                }
            }
        ).filter((info: ModDownloadInfo | undefined) => info !== undefined);

        // Get info for the mod, if we're looking for it.
        if (modId !== -1) {
            const modInfo: ModDownloadInfo | undefined = gameStats.find((info: ModDownloadInfo) => info.id === modId);
            return modInfo || { id: modId, total_downloads: 0, unique_downloads: 0 };
        }
        else return gameStats;
    }
    catch(err) {
        return Promise.reject(`Could not retrieve download data for ${gameDomain} ${modId} \n ${err}`)
    }
}

export { games, gameInfo, validate, quicksearch, updatedMods, modInfo, modFiles, modChangelogs, getDownloads };