import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API, IMod, NexusGQLError, IModsFilter, IModsSort } from './v2';

interface IResult {
    mods: IUpdatedModResults;
}

export interface IUpdatedModResults {
    nodes: IMod[];
    totalCount: number;
    // pageInfo?: {
    //     hasNextPage: boolean;
    //     hasPreviousPage: boolean;
    //     startCursor: string;
    //     endCursor: string;
    // }
}

const query = gql`
query getUpdatedMods($first: Int!, $filter: ModsFilter, $sort: [ModsSort!]) {
    mods( filter: { 
        hasUpdated: { op: EQUALS, value: "TRUE" }, 
        updatedAt: { op: GT, value: "1692352735" }, 
        gameId: { op: EQUALS, value: "1704" }  
        } 
        first: $first
        sort: { updatedAt: { direction: DESC } }
    ) {
        totalCount
        nodes {
            uid
            name
            modId
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
                id
                domainName
                name
            }
        }
    }
}
`;

export async function updatedMods(headers: Record<string,string>, newSince: Date | number | string, includeAdult: boolean, gameIds?: number | number[], sort: IModsSort
     = { updatedAt: { direction: 'ASC' }}): Promise<IUpdatedModResults> {

    const sinceDate: number = Math.floor(new Date(newSince).getTime() / 1000)
    // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
    const filter: IModsFilter = {
        // hasUpdated: {
        //     value: 'TRUE',
        //     op: 'EQUALS'
        // }
        updatedAt: {
            value: `${sinceDate}`,
            op: 'GT'
        }
    };

    if (!!gameIds && typeof gameIds === "number") filter.gameId = [{ value: gameIds.toString(), op: 'EQUALS' }];
    else if (!!gameIds && Array.isArray(gameIds)) {
        filter.filter = [{ gameId: gameIds.map(id => ({ value: id.toString(), op: 'EQUALS' })), op: 'OR' }];
    }

    const vars = {
        filter,
        sort,
        first: 10
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        // Adult content filter is not available on the API yet, so we'll have to do it manually.
        if (!includeAdult) result.mods.nodes = result.mods.nodes.filter(m => m.adult === false);
        return result.mods;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'updated mods');
        logMessage('Error in updated mods v2 request', error, true);
        return { nodes: [], totalCount: 0 };
    }
}