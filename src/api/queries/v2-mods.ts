import { request, gql } from "graphql-request";
import { Logger } from "../util.js";
import { v2API, IMod, NexusGQLError, IModsFilter, IModsSort } from './v2.js';

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
query DiscordBotMods($filter: ModsFilter, $sort: [ModsSort!], $count: Int) {
    mods(
        filter: $filter, 
        sort: $sort,
        count: $count
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
        downloads
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

/**
 * The API caps a page at 50 and defaults to 20. 'count' used to be passed as a
 * variable the query never declared, so it was discarded and every caller silently
 * got 20. The default here preserves that; feed callers can ask for more.
 */
export async function mods(headers: Record<string,string>, logger: Logger, filter: IModsFilter, sort: IModsSort = { endorsements: { direction: 'DESC' }}, count: number = 20): Promise<IModResults> {

    const vars = {
        filter,
        sort,
        count,
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.mods;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'mods');
        if (error.errors) logger.error('Error in mods v2 request', {error, headers});
        else logger.warn('Server error in mods v2 request', {error, headers});
        return { nodes: [], totalCount: 0 };
    }
}