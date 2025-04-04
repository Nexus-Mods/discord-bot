import { request, gql } from "graphql-request";
import { Logger } from "../util";
import { v2API, ICollection, NexusGQLError } from './v2';

interface IResult {
    collection: ICollection;
}

const query = gql`
query DiscordBotGetCollectionData($slug: String, $adult: Boolean, $domain: String) {
    collection(slug: $slug, viewAdultContent: $adult, domainName: $domain) {
        id
        slug
        name
        summary
        category {
            name
        }
        adultContent
        collectionStatus
        overallRating
        overallRatingCount
        endorsements
        totalDownloads
        draftRevisionNumber
        lastPublishedAt
        latestPublishedRevision {
            revisionNumber 
            fileSize
            modCount
            adultContent
            updatedAt
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
`;

export async function collection(headers: Record<string,string>, logger: Logger, slug: string, domain: string, adult: boolean): Promise<ICollection | undefined> {
    const vars = { slug, adult, domain };
    
    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.collection;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'collection');
        logger.error('Error in collection v2 request', error, true);
        return undefined;
    }
}