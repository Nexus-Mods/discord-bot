import { request, gql } from "graphql-request";
import { Logger } from "../util";
import { v2API, IMod, NexusGQLError, IModsFilter, IModsSort } from './v2';
import { IModForAutomod } from "../../feeds/AutoModManager";

interface IResult {
    mods: IModResults;
}

export interface IModResults {
    nodes: IModForAutomod[];
    totalCount: number;
}

const query = gql`
query DiscordBotLatestMods($filter: ModsFilter, $sort: [ModsSort!]) {
    mods(
        filter: $filter, 
        sort: $sort
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
        mirrors {
            name
            uri
        }
      }
      totalCount
    }
}
`;
// June 2025 - Temporarily removed "uploader.modCount" due to API changes;

export async function latestMods(headers: Record<string,string>, logger: Logger, startDate: Date, gameIds?: number | number[], sort: IModsSort = { createdAt: { direction: 'DESC' }}): Promise<IModResults> {

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
        // NOTE: 'count' is not declared in the query document above, so the server
        // applies its default page size (20). Adding $count: Int needs the v2 schema
        // confirmed first - see MODERNISATION.md B9.
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        // console.log(result.mods, filter)
        return result.mods;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'mods');
        // logger.error('Error in latestmods v2 request', error, true);
        throw error;
        // return { nodes: [], totalCount: 0 };
    }
}