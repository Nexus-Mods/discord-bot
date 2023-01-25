import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API } from './v2';

interface IResult {
    data: {
        games: IGame[];
    }
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
        return result.data.games;
    }
    catch(err) {
        logMessage('Error in games v2 request', err, true);
        return [];
    }
}