import { request, gql, type Variables } from "graphql-request";
import { NexusApiError } from '../errors.js';
import type { Logger } from "../logger.js";
import { v2API, NexusGQLError } from './v2.js';
import type { BaseFilterValue, BaseSortValue, FilterLogicalOperator } from "../../types/GQLTypes.js";

interface IResult {
    users: IUserResults;
}

interface IUserResults {
    nodes: IUser[];
    totalCount: number;
}

interface IVariables extends Variables {
    filter: IUserSearchFilter;
    sort?: IUserSearchSort[];
    offset?: number;
    count?: number;
}

interface IUserSearchFilter {
    filter?: IUserSearchFilter[];
    op?: FilterLogicalOperator;
    nameExact?: BaseFilterValue;
    nameWildcard?: BaseFilterValue | BaseFilterValue[];
}

interface IUserSearchSort {
    relevance?: BaseSortValue;
    name?: BaseSortValue;
}

interface IUser {
    avatar: string;
    name: string;
    memberId: number;
}

const query = gql`
query DiscordBotUserSearch($filter: UsersSearchFilter, $sort: [UsersSearchSort!]) {
    users(filter: $filter, sort: $sort)
    {
      nodes {
        name
        memberId
        avatar
      }
      totalCount
    }
}
`;

export async function users(headers: Record<string,string>, logger: Logger, name: string): Promise<IUser[]> {

    const vars: IVariables = {
        filter : {
            filter: [
                { nameWildcard: { op: 'WILDCARD', value: name } },
                { nameExact: { op: 'EQUALS', value: name } }
            ],
            op: 'OR'
        },
        sort: [
            { relevance: { direction: 'DESC' } },
            { name: { direction: 'ASC' } }
        ]
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.users.nodes;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'users');
        logger.error('Error in users v2 request', error, true);
        // Propagate rather than returning []. An empty array is a real answer -
        // "there are none" - and returning it on failure made the two indistinguishable,
        // which is how a failed feed poll came to look like a successful empty one.
        throw new NexusApiError('Nexus Mods API request failed (users)', {
            cause: error,
            userMessage: 'Nexus Mods could not be reached. Please try again shortly.',
        });
    }
}