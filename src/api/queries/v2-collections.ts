import { request, gql, Variables } from "graphql-request";
import { logMessage } from "../util";
import { v2API, ICollectionSearchResult, NexusGQLError } from './v2';
import * as GQLTypes from '../../types/GQLTypes';

interface IResult {
  collectionsV2: ICollectionSearchResult;
}

interface IQueryVariables extends Variables {
  filters: GQLTypes.ICollectionsFilter;
  count: number;
  sort: GQLTypes.CollectionsSort
}

const query = gql`
query DiscordBotSearchCollections(
  $filters: CollectionsSearchFilter, 
  $count: Int, 
  $sort: [CollectionsSearchSort!]
) {
  collectionsV2(filter: $filters, count: $count, sort: $sort) {
    nodes {
      id
      slug
      name
      summary
      category {
        name
      }
      overallRating
      overallRatingCount
      endorsements
      totalDownloads
      draftRevisionNumber
      latestPublishedRevision {
        adultContent
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
    nodesCount 
    nodesFilter
  }
}
`;

export async function collections(headers: Record<string,string>, filters: GQLTypes.ICollectionsFilter, sort: GQLTypes.CollectionsSort = {endorsements: { direction: 'DESC' }}, adultContent: boolean = true): Promise<ICollectionSearchResult> {
    const variables: IQueryVariables = {
        filters,
        sort,
        count: 5
    };

    // Only specify adult content if we explictly don't want to see it.
    if (adultContent === false) variables.filters.adultContent = { value: adultContent, op: 'EQUALS' };
    
    try {
        const result: IResult = await request(v2API, query, variables, headers);
        result.collectionsV2.searchURL = websiteLink(variables);
        return result.collectionsV2;
    }
    catch(err) {
      const error = new NexusGQLError(err as any, 'collections');
      logMessage('Error in collections v2 request', error, true);
      return { nodes: [], nodesCount: 0, nodesFilter: '', searchURL: websiteLink(variables) };
    }
}

const websiteLink = (variables: IQueryVariables): string => {
  const baseURL = 'https://next.nexusmods.com/search-results/collections?';
  const urlParams = new URLSearchParams();
  urlParams.append('adultContent', variables.filters.adultContent?.value === true ? '1' : '0');
  if (variables.filters.generalSearch) urlParams.append('keyword', variables.filters.generalSearch.value);
  if (variables.filters.gameName) urlParams.append('gameName', variables.filters.gameName.value);
  return `${baseURL}${urlParams.toString()}`;
}