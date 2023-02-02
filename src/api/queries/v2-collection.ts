import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API, ICollection } from './v2';

interface IResult {
    collection: ICollection;
}

const query = gql`
query getCollectionData($slug: String, $adult: Boolean, $domain: String) {
    collection(slug: $slug, viewAdultContent: $adult, domainName: $domain) {
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
  }
`;

export async function collection(headers: Record<string,string>, slug: string, domain: string, adult: boolean): Promise<ICollection | undefined> {
    const vars = { slug, adult, domain };
    
    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.collection;
    }
    catch(err) {
        logMessage('Error in collection v2 request', err, true);
        return undefined;
    }
}