import { request, gql } from "graphql-request";
import { Logger } from "../util";
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
query DiscordBotMods($filter: ModsFilter, $sort: [ModsSort!]) {
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

export async function mods(headers: Record<string,string>, logger: Logger, filter: IModsFilter, sort: IModsSort = { endorsements: { direction: 'DESC' }}): Promise<IModResults> {

    const vars = {
        filter,
        sort,
        // NOTE: 'count' is not declared in the query document above, so the server
        // applies its default page size (20). Adding $count: Int needs the v2 schema
        // confirmed first - see MODERNISATION.md B9.
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