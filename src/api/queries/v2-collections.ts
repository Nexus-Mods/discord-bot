import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API, ICollectionSearchResult } from './v2';
import * as GQLTypes from '../../types/GQLTypes';

interface IResult {
  collections: ICollectionSearchResult;
}

const query = gql`
query searchCollections($filters: CollectionsUserFilter, $adultContent: Boolean, $count: Int, $sortBy: String) {
    collections(filter: $filters, viewAdultContent: $adultContent, count: $count, sortBy: $sortBy) {
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
            }
            user {
              memberId
              avatar
              name
            }
            tileImage {
              url
              altText
            }
        }
        nodesFilter
        nodesCount
    }
  }
`;

export async function collections(headers: Record<string,string>, filters: GQLTypes.CollectionsFilter, sort: GQLTypes.CollectionsSortBy, adultContent?: boolean): Promise<ICollectionSearchResult> {
    const websiteLink = (): string => {
        const baseURL = 'https://next.nexusmods.com/search-results/collections?';
        const urlParams = new URLSearchParams();
        urlParams.append('sortBy', variables.sortBy);
        urlParams.append('adultContent', variables.filters.adultContent?.value === true ? '1' : '0' || '0');
        if (variables.filters.generalSearch) urlParams.append('keyword', variables.filters.generalSearch.value);
        if (variables.filters.gameName) urlParams.append('gameName', variables.filters.gameName.value);
        return `${baseURL}${urlParams.toString()}`;
    }

    const variables = {
        filters,
        sortBy: sort || 'endorsements_count',
        adultContent: adultContent || false,
        count: 5
    };
    
    try {
        const result: IResult = await request(v2API, query, variables, headers);
        result.collections.searchURL = websiteLink();
        return result.collections;
    }
    catch(err) {
        logMessage('Error in collections v2 request', err, true);
        return { nodes: [], nodesCount: 0, nodesFilter: '', searchURL: websiteLink() };
    }
}