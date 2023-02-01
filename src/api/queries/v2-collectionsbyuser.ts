import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API, ICollectionSearchResult } from './v2';
import * as GQLTypes from '../../types/GQLTypes';

interface IResult {
    collections: ICollectionSearchResult;
}

const query = gql`
query getCollectionsByUser($filters: CollectionsUserFilter, $adult: Boolean!) {
    collections(filter: $filters, viewAdultContent: $adult) {
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
              thumbnailUrl
            }
        }
        nodesFilter
        nodesCount
    }
  }
`;

export async function collectionsByUser(headers: Record<string,string>, id: number): Promise<ICollectionSearchResult> {
    const variables = {
        filters : {
          userId: [ { value: id.toString() } ]
        },
        adult: true,
    };
    
    try {
        const result: IResult = await request(v2API, query, variables, headers);
        return result.collections;
    }
    catch(err) {
        logMessage('Error in collectionsbyUser v2 request', err, true);
        return { nodes: [], nodesCount: 0, nodesFilter: '' };
    }
}