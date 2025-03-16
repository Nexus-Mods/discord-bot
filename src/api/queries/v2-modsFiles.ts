import { request, gql, Variables } from "graphql-request";
import { logMessage } from "../util";
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
      fileId
      name
      version
      category
      changelogText
      date
    }
}
`;

export async function modFiles(headers: Record<string,string>, gameId: number, modId: number): Promise<IModFile[]> {

    const vars: IVariables = {
        gameId,
        modId
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.modFiles.sort((a,b) => a.date - b.date);
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'modFiles');
        logMessage('Error in modFiles v2 request', error, true);
        return [];
    }
}