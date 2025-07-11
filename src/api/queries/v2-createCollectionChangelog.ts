import { request, gql } from "graphql-request";
import { Logger } from "../util";
import { NexusGQLError, v2API } from './v2';

interface IResult {
    createChangelog: {
        changelogId: string;
        success: boolean;
    }
}

interface ICreateChangelogVariables {
    revisionId: string;
    description: string;
}

const createQuery = gql`
mutation createChangelog(
    $revisionId: ID!,
    $description: String!
) {
    createChangelog(
        revisionId: $revisionId,
        description: $description
    ) {
        changelogId
        success
    }
}
`;

export async function createCollectionChangelog(headers: Record<string,string>, logger: Logger, revisionId: string): Promise<boolean> {
    const vars: ICreateChangelogVariables = { revisionId, description: 'This changelog was repaired by the Nexus Mods Discord Bot. You may now edit it.' }

    try {
        const result: IResult = await request(v2API, createQuery, vars, headers);
        return result.createChangelog.success;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'createChangelog');
        logger.error('Error in createChangelog v2 request', error, true);
        return false;
    }
}