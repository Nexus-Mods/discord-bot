import { ModStatus } from "@nexusmods/nexus-api";
import { request, gql, ClientError } from "graphql-request";
import { logMessage } from "../util";
import { v2API } from './v2';

export interface IResult {
    legacyModsByDomain: {
        nodes: IMod[];
    };
}

export interface IMod {
    uid: string;
    modId: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    summary: string;
    status: ModStatus;
    author: string;
    uploader: {
        name: string;
        avatar: string;
        memberId: number;
    }
    pictureUrl: string;
    modCategory: {
        name: string
    };
    adult: boolean;
    version: string;
    game: {
        domainName: string;
        name: string;
    }
}

interface IModRequest {
    gameDomain: string;
    modId: number;
}

const query = gql`
query Mods($ids: [CompositeDomainWithIdInput!]!, $count: Int!, $offset: Int!) {
    legacyModsByDomain(ids: $ids, count: $count, offset: $offset) {
      nodes {
        uid
        modId
        name
        createdAt
        updatedAt
        summary
        status
        author
        uploader {
          name
          avatar
          memberId
        }
        pictureUrl
        modCategory {
          name
        }
        adult
        version
        game {
          domainName
          name
        }
      }
    }
}
`;

export async function mods(headers: Record<string,string>, mods: IModRequest | IModRequest[]): Promise<IMod[]> {
    // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
    const ids: IModRequest[] = (!Array.isArray(mods)) ? [mods] : mods;
    if (!ids.length) return [];

    const pages: IModRequest[][] = [];
    let length = 0;
    while (length < (ids.length -1)) {
        pages.push(ids.slice(length, 50));
        length += 50;
    }

    let results: any[] = [];

    for (const page of pages) {
        try {
            const pageData = await modsQuery(headers, page);
            if (pageData.length != page.length) logMessage('Did not get back the same number of mods as sent', { sent: page.length, got: pageData.length }, true);
            results = [...results, ...pageData];
        }
        catch(err) {
            logMessage('Error fetching mod data', { err, headers }, true);
        }
    }

    return results;
}

async function modsQuery(headers: Record<string,string>, mods: IModRequest[], offset: Number = 0, count: Number = 50): Promise<IMod[]> {
    if (!mods.length) return [];

    try {
        const result: IResult = await request(v2API, query, { mods, offset, count }, headers);
        logMessage('Mods query', { result, mods });
        return result.legacyModsByDomain.nodes;
    }
    catch(err) {
        if (err as ClientError) {
            const error: ClientError = (err as ClientError);
            // console.log('ClientError', error);
            if (error.message.includes('Cannot return null for non-nullable field Mod.modCategory')) {
                const gameIds = new Set(mods.map(i => i.gameDomain));
                const consolidatedIds = [...gameIds].map(game => {
                    const gameMods = mods.filter(m => m.gameDomain === game).map(mod => mod.modId);
                    return `${game}: ${gameMods.join(', ')}`;
                });
                throw new Error('One or more mods are missing the category attribute.'+consolidatedIds.join('\n'));
            }
            else throw new Error('GraphQLError '+error);
        }
        logMessage('Unkown Mod Lookup Error!', err);
        throw new Error('Could not find some or all of the mods.');
    }

}