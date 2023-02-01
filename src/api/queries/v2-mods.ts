import { request, gql, ClientError } from "graphql-request";
import { logMessage } from "../util";
import { v2API, IMod } from './v2';
import * as GQLTypes from '../../types/GQLTypes';

interface IResult {
    mods: IModResults;
}

export interface IModResults {
    nodes: IMod[];
    totalCount: number;
}

export interface IModsSort {
    relevance?: GQLTypes.BaseSortValue
    name?: GQLTypes.BaseSortValue
    downloads?: GQLTypes.BaseSortValue
    endorsements?: GQLTypes.BaseSortValue
}

interface IModsFilter {
    filter?: IModsFilter[];
    op: GQLTypes.FilterLogicalOperator;
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
        }
      }
      totalCount
    }
}
`;

export async function mods(headers: Record<string,string>, query: string, gameId?: number, sort: IModsSort = { endorsements: 'DESC' }): Promise<IModResults> {
    // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
    const filter: IModsFilter[] = [
        {
            op: 'AND',
            nameStemmed: {
                value: query,
                op: 'WILDCARD'
            },
        }
    ];

    if (gameId) filter.push({
        op: 'AND',
        gameId: {
            value: gameId.toString(),
            op: 'EQUALS'
        }
    });

    const vars = {
        filter,
        sort
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.mods;
    }
    catch(err) {
        logMessage('Error in mods v2 request', err, true);
        return { nodes: [], totalCount: 0 };
    }
}