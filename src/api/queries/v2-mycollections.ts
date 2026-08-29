import { request, gql } from "graphql-request";
import { NexusApiError } from '../errors.js';
import type { Logger } from "../util.js";
import { v2API, type ICollection, NexusGQLError } from './v2.js';

interface IResult {
    myCollections: {
        nodes: ICollection[];
        nodesCount: number;
    };

}

const query = gql`
query DiscordBotMyCollections {
    myCollections(
      viewAdultContent: true,
      viewUnderModeration: true,
      viewUnlisted: true
    ) {
      nodesCount
      nodes {
        id
        slug
        name
        summary
        category {
          name
        }
        adultContent
        overallRating
        overallRatingCount
        endorsements
        totalDownloads
        draftRevisionNumber
        latestPublishedRevision {
          fileSize
          modCount
        }
        game {
          id
          domainName
          name
        }
        user {
          memberId
          avatar
          name
        }
        tileImage {
          url
          altText
          thumbnailUrl(size: small)
        }
      }
    }
  }
`;

export async function myCollections(headers: Record<string,string>, logger: Logger,): Promise<ICollection[]> {
    try {
        const result: IResult = await request(v2API, query, {}, headers);
        return result.myCollections.nodes;
    }
    catch(err) {
      const error = new NexusGQLError(err as any, 'mycollections');
        logger.error('Error in mycollections v2 request', error);
        // Propagate rather than returning []. An empty array is a real answer -
        // "there are none" - and returning it on failure made the two indistinguishable,
        // which is how a failed feed poll came to look like a successful empty one.
        throw new NexusApiError('Nexus Mods API request failed (my collections)', {
            cause: error,
            userMessage: 'Nexus Mods could not be reached. Please try again shortly.',
        });
    }
}