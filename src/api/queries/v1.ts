import { IChangelogs, IGameInfo, IGameListEntry, IModFiles, IModInfo, IUpdateEntry, IValidateKeyResponse } from '../../types/NexusModsAPIv1';
import axios, { AxiosError } from 'axios';
import { NexusAPIServerError, NexusSearchResult } from '../../types/util';
import { Logger } from "../util";

const nexusAPI: string = 'https://api.nexusmods.com/';

async function v1APIQuery <T>(logger: Logger, path: string, headers: Record<string, string>, params?: { [key: string]: any }): Promise<T> {
    const authType = 'OAUTH';
    try {
        const query = await axios({
            baseURL: nexusAPI,
            url: path,
            transformResponse: (data) => JSON.parse(data),
            headers,
            params,
        });
        return query.data;
    }
    catch(err) {
        if (err as AxiosError) return Promise.reject(new NexusAPIServerError(err as AxiosError, authType, path));
        logger.error('Unexpected API error', err, true);
        return Promise.reject(new Error(`Unexpected API error: ${(err as Error)?.message}`));
    }
}

export async function quicksearch(query: string, bIncludeAdult: boolean, game_id: number = 0): Promise<NexusSearchResult> {
    query = query.split(' ').toString();//query.replace(/[^A-Za-z0-9\s]/gi, '').split(' ').join(',');
    try {
        const searchQuery = await axios({
            baseURL: nexusAPI,
            url: '/mods',
            params: {
                terms: encodeURI(query),
                game_id,
                include_adult: bIncludeAdult,
            },
            transformResponse: (data) => JSON.parse(data),
            timeout: 15000
        });
        const results = {
            fullSearchURL: `https://www.nexusmods.com/search/?RH_ModList=nav:true,home:false,type:0,user_id:0,game_id:${game_id},advfilt:true,search%5Bfilename%5D:${query.split(',').join('+')},include_adult:${bIncludeAdult},page_size:20,show_game_filter:true`,
            ...searchQuery.data
        };
        // const searchQuery = await requestPromise({ url: nexusSearchAPI, qs: { terms: encodeURI(query), game_id, include_adult: bIncludeAdult }, timeout: 15000 });
        // let results = JSON.parse(searchQuery);
        // results.fullSearchURL = `https://www.nexusmods.com/search/?RH_ModList=nav:true,home:false,type:0,user_id:0,game_id:${game_id},advfilt:true,search%5Bfilename%5D:${query.split(',').join('+')},include_adult:${bIncludeAdult},page_size:20,show_game_filter:true`;
        return results;
    }
    catch(err) {
        return Promise.reject(err);
        // if ((err as Error).message.toLowerCase().includes('cloudflare')) return Promise.reject(new Error('Cloudflare error: Quicksearch request timed out.'));
        // return Promise.reject(new Error(`Nexus Mods Search API responded with ${(err as any).statusCode} while fetching results. Please try again later.`));
    }
}

export async function updatedMods(headers: Record<string,string>, logger: Logger, gameDomain: string, period: string = '1w', ) {
    return v1APIQuery<IUpdateEntry[]>(logger, `/v1/games/${gameDomain}/mods/updated.json`, headers, { period });
}

export async function modInfo(headers: Record<string,string>, logger: Logger, gameDomain: string, modId: number): Promise<IModInfo> {
    return v1APIQuery(logger, `/v1/games/${gameDomain}/mods/${modId}.json`, headers);
}

export async function modFiles(headers: Record<string,string>, logger: Logger, gameDomain: string, modId: number): Promise<IModFiles> {
    return v1APIQuery(logger, `/v1/games/${gameDomain}/mods/${modId}/files.json`, headers);
}

export async function modChangelogs(headers: Record<string,string>, logger: Logger, gameDomain: string, modId: number): Promise<IChangelogs> {
    return v1APIQuery(logger, `/v1/games/${gameDomain}/mods/${modId}/changelogs.json`, headers);
}

export async function games(headers: Record<string,string>, logger: Logger,): Promise<IGameInfo[]> {
    return v1APIQuery(logger, `/v1/games.json`, headers);
} 

export async function game(headers: Record<string,string>, logger: Logger, domain: string): Promise<IGameListEntry> {
    return v1APIQuery(logger, `/v1/games/${domain}.json`, headers);
} 

export async function validate(headers: Record<string,string>, logger: Logger,): Promise<IValidateKeyResponse> {
    return v1APIQuery(logger, '/v1/users/validate.json', headers);
}
