import { request, gql, type ClientError } from "graphql-request";
import { NexusApiError } from '../errors.js';
import type { Logger } from "../logger.js";
import { v2API, type IMod, NexusGQLError } from './v2.js';

interface IResult {
    legacyModsByDomain: {
        nodes: IMod[];
    };
}

interface IModRequest {
    gameDomain: string;
    modId: number;
}

const query = gql`
query DiscordBotModsByDomain($mods: [CompositeDomainWithIdInput!]!, $count: Int!, $offset: Int!) {
    legacyModsByDomain(ids: $mods, count: $count, offset: $offset) {
      nodes {
        uid
        modId
        name
        createdAt
        updatedAt
        summary
        description
        status
        author
        uploader {
          name
          avatar
          memberId
        }
        pictureUrl
        modCategory {
          name
        }
        adult
        version
        game {
          id
          domainName
          name
        }
      }
    }
}
`;

export async function mods(headers: Record<string,string>, logger: Logger, mods: IModRequest | IModRequest[]): Promise<IMod[]> {
    // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
    const ids: IModRequest[] = (!Array.isArray(mods)) ? [mods] : mods;
    if (!ids.length) return [];

    const pages: IModRequest[][] = [];
    let length = 0;
    while (length < (ids.length)) {
        pages.push(ids.slice(length, length + 50));
        length += 50;
    }

    let results: any[] = [];

    for (const page of pages) {
        try {
            const pageData = await modsQuery(headers, logger, page);
            if (pageData.length !== page.length) logger.warn('Did not get back the same number of mods as sent', { sent: page.length, got: pageData.length }, true);
            results = [...results, ...pageData];
        }
        catch(err) {
            const error = new NexusGQLError(err as any, 'mods');
            logger.error('Error fetching mod data', { error, auth: 'OAUTH', page: page.length }, true);
            // Previously this logged and carried on, so a failure on page 3 of 5 returned
            // four pages of mods as though that were the whole answer. For a feed that
            // reads as "those mods have no updates" and the window then moves past them.
            // A partial answer is worse than no answer here.
            throw new NexusApiError('Nexus Mods API request failed (mods)', {
                cause: error,
                context: { requested: ids.length, retrieved: results.length },
                userMessage: 'Nexus Mods could not be reached. Please try again shortly.',
            });
        }
    }

    return results;
}

async function modsQuery(headers: Record<string,string>, logger: Logger, mods: IModRequest[], offset: number = 0, count: number = 50): Promise<IMod[]> {
    if (!mods.length) return [];

    try {
        const result: IResult = await request(v2API, query, { mods, offset, count }, headers);
        return result.legacyModsByDomain.nodes;
    }
    catch(err) {
        if (err as ClientError) {
            const error: ClientError = (err as ClientError);
            if (error.message.includes('Cannot return null for non-nullable field Mod.modCategory')) {
                const gameIds = new Set(mods.map(i => i.gameDomain));
                const consolidatedIds = [...gameIds].map(game => {
                    const gameMods = mods.filter(m => m.gameDomain === game).map(mod => mod.modId);
                    return `${game}: ${gameMods.join(', ')}`;
                });
                throw new Error('One or more mods are missing the category attribute.'+consolidatedIds.join('\n'), { cause: err });
            }
            else throw new Error('GraphQLError '+error, { cause: err });
        }
        logger.error('Unkown Mod Lookup Error!', err);
        throw new Error('Could not find some or all of the mods.', { cause: err });
    }

}
