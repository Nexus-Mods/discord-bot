import { request, gql } from "graphql-request";
import { Logger } from "../util";
import { v2API, IMod, NexusGQLError } from './v2';

interface IResult {
    modsByUid: IModResults;
}

interface IModResults {
    nodes: IMod[];
    totalCount: number;
}

const query = gql`
query DiscordBotModsByUid($uids: [ID!]!) {
    modsByUid(uids: $uids)
    {
      nodes {
        uid
        modId
        name
        createdAt
        updatedAt
        summary
        status
        author
        uploader {
          name
          avatar
          memberId
        }
        pictureUrl
        # modCategory {
        #  name
        # }
        adult
        version
        downloads
        game {
          domainName
          name
          id
        }
      }
      totalCount
    }
}
`;

type IModWithoutCategory = Omit<IMod,'modcategory'>;

export async function modsByUid(headers: Record<string,string>, logger: Logger, uids: string[]): Promise<IModWithoutCategory[]> {

    const vars = {
        uids
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.modsByUid.nodes;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'modsByUid');
        logger.error('Error in modsbyuid v2 request', error, true);
        return [];
    }
}