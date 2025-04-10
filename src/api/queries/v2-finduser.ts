import { request, gql } from "graphql-request";
import { Logger } from "../util";
import { NexusGQLError, v2API } from './v2';

interface IResult {
    user?: IUser;
    userByName?: IUser;
}

export interface IUser {
    name: string;
    memberId: number;
    avatar: string;
    recognizedAuthor: boolean;
    uniqueModDownloads: number;
    banned: boolean;
    deleted: boolean;
}

const idQuery = gql`
query DiscordBotUserById($id: Int!) {
    user(id: $id) {
        name
        memberId
        avatar
        recognizedAuthor
        uniqueModDownloads
        banned
        deleted
    }
}
`;

const nameQuery = gql`
query UserByName($username: String!) {
    userByName(name: $username) {
        name
        memberId
        avatar
        recognizedAuthor
        uniqueModDownloads
        banned
        deleted
    }
}
`;

export async function findUser(headers: Record<string,string>, logger: Logger, idOrName: number | string): Promise<IUser | undefined> {
    let vars: Record<string, string | number>;
    let query: string = ``;

    if (typeof(idOrName) === 'number') {
        query = idQuery;
        vars = { id: idOrName };

    }
    else if (typeof(idOrName) === 'string') {
        query = nameQuery;
        vars = { username: idOrName };
    }
    else throw new Error('Invalid username or ID');

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.user || result.userByName;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'findUser');
        logger.error('Error in findUser v2 request', error, true);
        return undefined;
    }
}