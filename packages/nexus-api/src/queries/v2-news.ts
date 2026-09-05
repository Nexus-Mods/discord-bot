import { request, gql, type Variables } from "graphql-request";
import { NexusApiError } from '@nexusmods/core/errors.js';
import type { Logger } from "@nexusmods/core/logger.js";
import { v2API, NexusGQLError } from './v2.js';
import { type INews, News } from "../types/feeds.js";

interface IResult {
    news: INewResults;
}

interface INewsVariables extends Variables {
    gameId?: number;
}

interface INewResults {
    nodes: INews[];
}

const query = gql`
query DiscordBotNews($gameId: Int) {
    news(gameId: $gameId) {
        nodes {
            id
            title
            newsCategory {
                name
            }
            summary
            date
            author {
                name
                avatar
            }
            header
            image
        }

    }
}
`;

export async function news(headers: Record<string, string>, logger: Logger, gameId?: number): Promise<News[]> {

    const vars: INewsVariables = {}
    
    if (gameId) vars.gameId = gameId;


    try {
        const result: IResult = await request(v2API, query, vars, headers);
        // Adult content filter is not available on the API yet, so we'll have to do it manually.
        const news =result.news.nodes.map(n => new News(n));
        return news;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'news');
        logger.error('Error in news v2 request', error, true);
        // Propagate rather than returning []. An empty array is a real answer -
        // "there are none" - and returning it on failure made the two indistinguishable,
        // which is how a failed feed poll came to look like a successful empty one.
        throw new NexusApiError('Nexus Mods API request failed (news)', {
            cause: error,
            userMessage: 'Nexus Mods could not be reached. Please try again shortly.',
        });
    }
}