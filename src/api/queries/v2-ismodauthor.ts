import { request, gql } from "graphql-request";
import { logMessage } from "../util";
import { v2API } from './v2';

export interface IResult {
    data: {
        user: {
            name: string;
            recognizedAuthor: boolean;
        }
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
        return result.data?.user?.recognizedAuthor;
    }
    catch(err) {
        logMessage('Error in isModAuthor v2 request', err, true);
        return false;
    }
}