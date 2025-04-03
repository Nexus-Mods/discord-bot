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
        count: 10
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.mods;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'mods');
        if (error.errors) logger.error('Error in mods v2 request', error, true);
        else logger.warn('Server error in mods v2 request', error, true);
        return { nodes: [], totalCount: 0 };
    }
}