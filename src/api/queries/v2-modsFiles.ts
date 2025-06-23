import { request, gql, Variables } from "graphql-request";
import { Logger } from "../util";
import { v2API, NexusGQLError, IModFile } from './v2';

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
        return [];
    }
}