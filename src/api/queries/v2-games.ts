import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { NexusGQLError, v2API } from './v2';

interface IResult {
    games: IGame[];
}

export interface IGame {
    id: number;
    name: string;
    approvedAt: Date | null;
    domainName: string;
    collectionCount: number | null;

}

const query = gql`
query Games {
    games {
        id
        name
        approvedAt
        domainName
        collectionCount
    }
}
`;

export async function games(headers: Record<string,string>): Promise<IGame[]> {
    try {
        const result: IResult = await request(v2API, query, {}, headers);
        return result.games;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'games');
        logMessage('Error in games v2 request', error, true);
        return [];
    }
}