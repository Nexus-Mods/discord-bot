import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API, NexusGQLError } from './v2';

interface IResult {
    collections: {
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

interface ITotals {
  totalDownloads: number;
  uniqueDownloads: number;
}

const query = gql`
query getTotalDownloadsForCollections($filters: CollectionsUserFilter, $offset: Int!) {
  collections(
      filter: $filters, 
      viewAdultContent: true, 
      viewUnlisted: true, 
      count: 20, 
      offset: $offset, 
      sortBy: "total_downloads"
  ) {
      nodes {
          slug
          name
          totalDownloads
          uniqueDownloads
          game {
            domainName
          }
      }
      nodesCount
  }
}
`;

export async function collectionsDownloadTotals(headers: Record<string,string>, id: number): Promise<ITotals> {
    const variables = {
        filters : {
          userId: [ { value: id.toString() } ]
        },
        offset: 0,
    };
    
    try {
        let totalRequested = 20;
        const result: IResult = await request(v2API, query, variables, headers);
        let stats = result.collections.nodes;
        const total = result.collections.nodesCount;
        while (total > stats.length) {
          // Fetch additional pages
          logMessage('Fetching additional collections page', { id, total, totalRequested });
          variables.offset += 20;
          totalRequested += 20;
          const extraPage: IResult = await request(v2API, query, variables, headers);
          const extraItems = extraPage.collections.nodes;
          stats = [...stats, ...extraItems];
        }
        // Consolidate the stats.
        logMessage('Accumulating downloads for collections', { count: stats.length })
        const totals = stats.reduce((prev, cur) => {
          prev.totalDownloads += cur.totalDownloads
          prev.uniqueDownloads += prev.uniqueDownloads
          return prev;
        }, { totalDownloads: 0, uniqueDownloads: 0 });

        logMessage('Collection download totals', {totals, stats});
        return totals;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'collectionsDownloadTotals');
        logMessage('Error in collectionsDownloadTotals v2 request', error, true);
        return { totalDownloads: 0, uniqueDownloads: 0 };
    }
}