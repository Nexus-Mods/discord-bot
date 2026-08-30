import type { IChangelogs, IGameInfo, IGameListEntry, IModFiles, IModInfo, IUpdateEntry, IValidateKeyResponse } from '../../types/NexusModsAPIv1.js';
import { NexusApiError } from '../errors.js';
import { NexusAPIServerError } from '../../types/NexusAPIError.js';
import type { Logger } from "../util.js";

const nexusAPI: string = 'https://api.nexusmods.com/';

async function v1APIQuery <T>(logger: Logger, path: string, headers: Record<string, string>, params?: Record<string, string | number | boolean>): Promise<T> {
    const authType = 'OAUTH';
    try {
        const url = new URL(path, nexusAPI);
        if (params) url.search = new URLSearchParams(Object.entries(params).map(([k, v]): [string, string] => [k, String(v)])).toString();
        const res = await fetch(url, { headers });
        if (!res.ok) throw new NexusAPIServerError(res.status, authType, path);
        const data = await res.json();
        return data as T;
    }
    catch(err) {
        logger.error('Unexpected v1 API error', err, true);
        if (err instanceof NexusAPIServerError) throw err;
        throw new NexusApiError('Unexpected Nexus Mods API error.', { cause: err });
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
