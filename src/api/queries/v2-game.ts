import { request, gql } from "graphql-request";
import { Logger } from "../util";
import { NexusGQLError, v2API } from './v2';

interface IResult {
    game: IGame;
}

interface IGame {
    id: number;
    name: string;
    approvedAt: Date | null;
    domainName: string;
    collectionCount: number | null;
}

const query = gql`
query DiscordBotGame {
    game {
        id
        name
        approvedAt
        domainName
        collectionCount
    }
}
`;

export async function game(headers: Record<string,string>, logger: Logger, id: number): Promise<IGame|undefined> {
    // Games can't be queried by domain name at the moment. 
    try {
        const result: IResult = await request(v2API, query, { id }, headers);
        return result.game;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'games');
        logger.error('Error in games v2 request', error, true);
        return undefined;
    }
}