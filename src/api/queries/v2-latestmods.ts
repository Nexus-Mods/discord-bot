import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API, IMod, NexusGQLError, IModsFilter, IModsSort } from './v2';

interface IResult {
    mods: IModResults;
}

export interface IModResults {
    nodes: Partial<IMod>[];
    totalCount: number;
}

const query = gql`
query Mods($filter: ModsFilter, $sort: [ModsSort!]) {
    mods(
        filter: $filter, 
        sort: $sort
    ) {
      nodes {
        name
        summary
        game {
            domainName
            name
        }
        modId
        createdAt
        updatedAt
        description
        uploader {
          name
          memberId
          joined
          membershipRoles
          modCount
        }
        pictureUrl
      }
      totalCount
    }
}
`;

export async function latestMods(headers: Record<string,string>, startDate: Date, gameIds?: number | number[], sort: IModsSort = { createdAt: { direction: 'DESC' }}): Promise<IModResults> {
    // Force setting header version
    if (headers['api-version'] !== '2024-09-01') {
        headers['api-version'] = '2024-09-01'
        logMessage('OUTDATED QUERY [Latest Mods] - API Version header must be set to 2024-09-01 for this request')
    }
    
    if (typeof startDate === 'string') {
        startDate = new Date(startDate)
    }
    
    // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
    const filter: IModsFilter = {
        createdAt: {
            value: Math.floor(startDate.getTime() / 1000).toString(),
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
        count: 50
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        // console.log(result.mods, filter)
        return result.mods;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'mods');
        logMessage('Error in latestmods v2 request', error, true);
        return { nodes: [], totalCount: 0 };
    }
}