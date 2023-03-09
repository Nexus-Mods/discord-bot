import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { NexusGQLError, v2API } from './v2';

export interface IResult {
    user: {
        name: string;
        recognizedAuthor: boolean;
    }
}

const query = gql`
query getModAuthorStatus($id: Int!) {
    user(id: $id) {
        name
        recognizedAuthor
    }
}
`;

export async function isModAuthor(headers: Record<string,string>, id: number): Promise<boolean> {
    const vars = { id };

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        return result.user?.recognizedAuthor;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'isModAuthor');
        logMessage('Error in isModAuthor v2 request', error, true);
        return false;
    }
}