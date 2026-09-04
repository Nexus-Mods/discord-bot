import { request, gql, type Variables } from "graphql-request";
import { NexusApiError } from '../errors.js';
import type { Logger } from "../logger.js";
import { v2API, NexusGQLError, type IModFile } from './v2.js';

interface IResult {
    modFiles: IModFile[];
}

interface IVariables extends Variables {
    modId: number;
    gameId: number;
}

const query = gql`
query DiscordBotModFiles($modId: ID!, $gameId: ID!) {
    modFiles(modId: $modId, gameId: $gameId) {
      uid
      uri
      fileId
      name
      version
      category
      changelogText
      date
      description
      manager
      scannedV2
    }
}
`;

export async function modFiles(headers: Record<string,string>, logger: Logger, gameId: number, modId: number): Promise<IModFile[]> {

    const vars: IVariables = {
        gameId,
        modId
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.modFiles.sort((a,b) => b.date - a.date);
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'modFiles');
        logger.error('Error in modFiles v2 request', error, true);
        // Propagate rather than returning []. An empty array is a real answer -
        // "there are none" - and returning it on failure made the two indistinguishable,
        // which is how a failed feed poll came to look like a successful empty one.
        throw new NexusApiError('Nexus Mods API request failed (mod files)', {
            cause: error,
            userMessage: 'Nexus Mods could not be reached. Please try again shortly.',
        });
    }
}