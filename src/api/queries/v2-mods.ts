import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API, IMod, NexusGQLError, IModsFilter, IModsSort } from './v2';

interface IResult {
    mods: IModResults;
}

export interface IModResults {
    nodes: IMod[];
    totalCount: number;
    // For backwards compatibility
    fullSearchUrl?: string;
}

const query = gql`
query Mods($filter: ModsFilter, $sort: [ModsSort!]) {
    mods(
        filter: $filter, 
        sort: $sort
    ) {
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
          id
        }
      }
      totalCount
    }
}
`;

export async function mods(headers: Record<string,string>, searchTerm: string, includeAdult: boolean, gameIds?: number | number[], sort: IModsSort = { endorsements: { direction: 'DESC' }}): Promise<IModResults> {
    // Force setting header version
    if (headers['api-version'] !== '2024-09-01') {
        headers['api-version'] = '2024-09-01'
        logMessage('OUTDATED QUERY [Mods] - API Version header must be set to 2024-09-01 for this request')
    }
    
    // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
    const filter: IModsFilter = {
        name: {
            value: searchTerm,
            op: 'WILDCARD'
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
        const error = new NexusGQLError(err as any, 'mods');
        logMessage('Error in mods v2 request', error, true);
        return { nodes: [], totalCount: 0 };
    }
}