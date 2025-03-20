import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API, ICollection, NexusGQLError, ICollectionRevision } from './v2';

interface IResult {
    collection: ICollection & { revisions: ICollectionRevision[] };
}

const query = gql`
query DiscordBotGetCollectionRevisionData($slug: String, $domain: String) {
    collection(slug: $slug, viewAdultContent: true, domainName: $domain) {
        id
        slug
        name
        revisions {
            revisionNumber 
            fileSize
            modCount
            adultContent
            updatedAt
            collectionChangelog {
                description
            }
            status
        } 
    }
  }
`;

export async function collectionRevisions(headers: Record<string,string>, slug: string, domain: string): Promise<ICollection & { revisions: ICollectionRevision[] } | undefined> {
    const vars = { slug, domain };
    
    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.collection;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'collectionRevisions');
        logMessage('Error in collectionRevisions v2 request', error, true);
        return undefined;
    }
}