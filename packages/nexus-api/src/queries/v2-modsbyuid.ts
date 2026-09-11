import { request, gql } from "graphql-request";
import { NexusApiError } from '@nexusmods/core/errors.js';
import type { Logger } from "@nexusmods/core/logger.js";
import { v2API, type IMod, NexusGQLError } from './v2.js';

interface IResult {
    modsByUid: IModResults;
}

interface IModResults {
    nodes: IMod[];
    totalCount: number;
}

const query = gql`
query DiscordBotModsByUid($uids: [ID!]!) {
    modsByUid(uids: $uids)
    {
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

export async function modsByUid(headers: Record<string,string>, logger: Logger, uids: string[]): Promise<IMod[]> {

    const vars = {
        uids
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.modsByUid.nodes;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'modsByUid');
        logger.error('Error in modsbyuid v2 request', error, true);
        // Propagate rather than returning []. An empty array is a real answer -
        // "there are none" - and returning it on failure made the two indistinguishable,
        // which is how a failed feed poll came to look like a successful empty one.
        throw new NexusApiError('Nexus Mods API request failed (mods by uid)', {
            cause: error,
            userMessage: 'Nexus Mods could not be reached. Please try again shortly.',
        });
    }
}