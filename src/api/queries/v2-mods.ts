import { request, gql, ClientError } from "graphql-request";
import { logMessage } from "../util";
import { v2API, IMod, NexusGQLError } from './v2';
import * as GQLTypes from '../../types/GQLTypes';

interface IResult {
    mods: IModResults;
}

export interface IModResults {
    nodes: IMod[];
    totalCount: number;
    // For backwards compatibility
    fullSearchUrl?: string;
}

export interface IModsSort {
    relevance?: { direction: GQLTypes.BaseSortValue }
    name?: { direction: GQLTypes.BaseSortValue }
    downloads?: { direction: GQLTypes.BaseSortValue }
    endorsements?: { direction: GQLTypes.BaseSortValue }
}

interface IModsFilter {
    filter?: IModsFilter[];
    op?: GQLTypes.FilterLogicalOperator;
    name?: GQLTypes.BaseFilterValue;
    nameStemmed?: GQLTypes.BaseFilterValue;
    gameId?: GQLTypes.BaseFilterValue; //This is the numerical ID for a game, not the domain. 
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

export async function mods(headers: Record<string,string>, searchTerm: string, includeAdult: boolean, gameId?: number, sort: IModsSort = { endorsements: { direction: 'DESC' }}): Promise<IModResults> {
    // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
    const filter: IModsFilter = {
        name: {
            value: searchTerm,
            op: 'WILDCARD'
        }
    };

    if (gameId) filter.gameId = { value: gameId.toString(), op: 'EQUALS' };

    const vars = {
        filter,
        sort
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