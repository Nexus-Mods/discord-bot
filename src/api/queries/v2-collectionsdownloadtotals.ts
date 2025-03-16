import { request, gql, Variables } from "graphql-request";
import { logMessage } from "../util";
import { v2API, NexusGQLError } from './v2';
import * as GQLTypes from '../../types/GQLTypes';

interface IResult {
    collectionsV2: {
      nodes: IDownloadStats[];
      nodesCount: number;
    };
}

interface IDownloadStats {
    slug: string;
    name: string;
    totalDownloads: number;
    uniqueDownloads: number;
    game: {
      domainName: number;
    }
};

interface IQueryVariables extends Variables {
  filters: GQLTypes.CollectionsUserFilter;
  offset: number;
  sort: GQLTypes.CollectionsSort
}

interface ITotals {
  totalDownloads: number;
  uniqueDownloads: number;
}

const query = gql`
query DiscordBotGetTotalDownloadsForCollections(
  $filters: CollectionsSearchFilter, 
  $offset: Int!,
  $sort: [CollectionsSearchSort!]
) {
  collectionsV2(
    filter: $filters,
    count: 20, 
    offset: $offset, 
    sort: $sort
  ) {
    nodes {
      slug
      name
      totalDownloads
      uniqueDownloads
      game {
        domainName
        name
      }
    }
    nodesCount 
    nodesFilter
  }
}
`;

export async function collectionsDownloadTotals(headers: Record<string,string>, id: number): Promise<ITotals> {
    const variables: IQueryVariables = {
        filters : {
          userId:  { value: id.toString(), op: 'EQUALS' }
        },
        sort: {
          downloads: { direction: 'DESC' }
        },
        offset: 0,
    };
    
    try {
        let totalRequested = 20;
        const result: IResult = await request(v2API, query, variables, headers);
        let stats = result.collectionsV2.nodes;
        const total = result.collectionsV2.nodesCount;
        while (total > stats.length) {
          // Fetch additional pages
          logMessage('Fetching additional collections page', { id, total, totalRequested });
          variables.offset += 20;
          totalRequested += 20;
          const extraPage: IResult = await request(v2API, query, variables, headers);
          const extraItems = extraPage.collectionsV2.nodes;
          stats = [...stats, ...extraItems];
        }
        // Consolidate the stats.
        const totals = stats.reduce((prev, cur) => {
          prev = { totalDownloads: prev.totalDownloads + cur.totalDownloads, uniqueDownloads: prev.uniqueDownloads + cur.uniqueDownloads };
          return prev;
        }, { totalDownloads: 0, uniqueDownloads: 0 });
        return totals;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'collectionsDownloadTotals');
        logMessage('Error in collectionsDownloadTotals v2 request', error, true);
        return { totalDownloads: 0, uniqueDownloads: 0 };
    }
}