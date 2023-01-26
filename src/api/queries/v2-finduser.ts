import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API } from './v2';

export interface IResult {
    data: {
        user?: IUser;
        userByName?: IUser;
    };
}

export interface IUser {
    name: string;
    memberId: number;
    avatar: string;
    recognizedAuthor: boolean;
}

const idQuery = gql`
query UserById($id: Int!) {
    user(id: $id) {
        name
        memberId
        avatar
        recognizedAuthor
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
    }
}
`;

export async function findUser(headers: Record<string,string>, idOrName: number | string): Promise<IUser | undefined> {
    let vars;
    let query = gql``;

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
        return result.data.user || result.data.userByName;
    }
    catch(err) {
        logMessage('Error in findUser v2 request', err, true);
        return undefined;
    }
}