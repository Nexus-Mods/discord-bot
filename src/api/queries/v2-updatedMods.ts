import { request, gql } from "graphql-request";
import { Logger } from "../util";
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
query DiscordBotGetUpdatedMods($count: Int!, $filter: ModsFilter, $sort: [ModsSort!]) {
    mods( 
        filter: $filter 
        count: $count
        sort: $sort
    ) {
        totalCount
        nodes {
            uid
            name
            modId
            createdAt
            updatedAt
            summary
            description
            status
            author
            uploader {
                name
                avatar
                memberId
                joined
                membershipRoles
                modCount
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

export async function updatedMods(
    headers: Record<string,string>, 
    logger: Logger,
    newSince: Date | number | string, 
    includeAdult: boolean, 
    gameIds?: number | number[], 
    sort: IModsSort = { updatedAt: { direction: 'ASC' }}
): Promise<IUpdatedModResults> {

    const sinceDate: number = Math.floor(new Date(newSince).getTime() / 1000)
    // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
    const filter: IModsFilter = {
        hasUpdated: {
            value: true,
            op: 'EQUALS'
        },
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
        count: 10
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        // Adult content filter is not available on the API yet, so we'll have to do it manually.
        if (!includeAdult) result.mods.nodes = result.mods.nodes.filter(m => m.adult === false);
        return result.mods;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'updated mods');
        logger.error('Error in updated mods v2 request', error);
        return { nodes: [], totalCount: 0 };
    }
}