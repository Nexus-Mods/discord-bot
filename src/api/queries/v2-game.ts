import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { NexusGQLError, v2API } from './v2';

interface IResult {
    game: IGame;
}

export interface IGame {
    id: number;
    name: string;
    approvedAt: Date | null;
    domainName: string;
    collectionCount: number | null;

}

const query = gql`
query Game {
    game {
        id
        name
        approvedAt
        domainName
        collectionCount
    }
}
`;

export async function game(headers: Record<string,string>, id: number): Promise<IGame|undefined> {
    // Games can't be queried by domain name at the moment. 
    try {
        const result: IResult = await request(v2API, query, { id }, headers);
        return result.game;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'games');
        logMessage('Error in games v2 request', error, true);
        return undefined;
    }
}