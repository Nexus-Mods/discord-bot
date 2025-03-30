import { request, gql } from "graphql-request";
import { Logger } from "../util";
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
query DiscordBotGames {
    games {
        id
        name
        approvedAt
        domainName
        collectionCount
    }
}
`;

export async function games(headers: Record<string,string>, logger: Logger,): Promise<IGame[]> {
    throw new Error('Games query is no longer functional due to API updates (July 2024)')
    try {
        const result: IResult = await request(v2API, query, {}, headers);
        return result.games;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'games');
        logger.error('Error in games v2 request', error, true);
        return [];
    }
}