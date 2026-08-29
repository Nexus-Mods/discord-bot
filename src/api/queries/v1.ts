import type { IChangelogs, IGameInfo, IGameListEntry, IModFiles, IModInfo, IUpdateEntry, IValidateKeyResponse } from '../../types/NexusModsAPIv1.js';
import { NexusApiError } from '../errors.js';
import axios, { type AxiosError } from 'axios';
import { NexusAPIServerError } from '../../types/NexusAPIError.js';
import type { NexusSearchResult } from '../../types/util.js';
import type { Logger } from "../util.js";

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
        if (err as AxiosError) throw new NexusAPIServerError(err as AxiosError, authType, path);
        logger.error('Unexpected API error', err, true);
        throw new NexusApiError('Unexpected Nexus Mods API error.', { cause: err });
    }
}

export async function quicksearch(query: string, bIncludeAdult: boolean, game_id: number = 0): Promise<NexusSearchResult> {
    query = query.split(' ').toString();//query.replace(/[^A-Za-z0-9\s]/gi, '').split(' ').join(',');
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
    return results;
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
