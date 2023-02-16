import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API, ICollection } from './v2';

interface IResult {
    myCollections: {
        nodes: ICollection[];
        nodesCount: number;
    };

}

const query = gql`
query MyCollections {
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

export async function myCollections(headers: Record<string,string>): Promise<ICollection[]> {
    try {
        const result: IResult = await request(v2API, query, {}, headers);
        return result.myCollections.nodes;
    }
    catch(err) {
        logMessage('Error in mycollections v2 request', {err}, true);
        return [];
    }
}