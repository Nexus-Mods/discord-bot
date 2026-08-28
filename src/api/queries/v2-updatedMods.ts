import { request, gql } from "graphql-request";
import { Logger } from "../util.js";
import { v2API, NexusGQLError, IModsFilter, IModsSort, IModForAutomod } from './v2.js';

interface IResult {
    mods: IUpdatedModResults;
}

interface IUpdatedModResults {
    nodes: IModForAutomod[];
    totalCount: number;
    // pageInfo?: {
    //     hasNextPage: boolean;
    //     hasPreviousPage: boolean;
    //     startCursor: string;
    //     endCursor: string;
    // }
}

const query = gql`
query DiscordBotGetUpdatedMods($filter: ModsFilter, $sort: [ModsSort!], $count: Int) {
    mods(
        filter: $filter, 
        sort: $sort,
        count: $count
    ) {
      nodes {
        uid
        name
        summary
        game {
            domainName
            name
            id
        }
        modId
        createdAt
        updatedAt
        description
        uploader {
          name
          memberId
          joined
          modCount
        }
        pictureUrl
      }
      totalCount
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
        count: 50,
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