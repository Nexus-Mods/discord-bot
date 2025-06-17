import { request, gql } from "graphql-request";
import { Logger } from "../util";
import { v2API, IMod, NexusGQLError, IModsFilter, IModsSort } from './v2';
import { IModForAutomod } from "../../feeds/AutoModManager";

interface IResult {
    mods: IModResults;
}

export interface IModResults {
    nodes: IModForAutomod[];
    totalCount: number;
}

const query = gql`
query DiscordBotLatestMods($filter: ModsFilter, $sort: [ModsSort!]) {
    mods( 
        filter: $filter 
        count: $count
        sort: $sort
    ) {
        totalCount
        nodes {
            uid
            name
            modId
            createdAt
            updatedAt
            adult
            summary
            description
            status
            author
            uploader {
                name
                memberId
                joined
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
// June 2025 - Temporarily removed "uploader.modCount" due to API changes;

export async function latestMods(headers: Record<string,string>, logger: Logger, startDate: Date, gameIds?: number | number[], sort: IModsSort = { createdAt: { direction: 'DESC' }}): Promise<IModResults> {

    if (typeof startDate === 'string') {
        startDate = new Date(startDate)
    }
    
    // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
    const filter: IModsFilter = {
        createdAt: {
            value: Math.floor(startDate.getTime() / 1000).toString(),
            op: 'GT'
        }
    };

    if (!!gameIds && typeof gameIds === "number") filter.gameId = [{ value: gameIds.toString(), op: 'EQUALS' }];
    else if (!!gameIds && Array.isArray(gameIds)) {
        filter.filter = [{ gameId: gameIds.map(id => ({ value: id.toString(), op: 'EQUALS' })), op: 'OR' }];
    }

    const vars = {
        filter,
        sort,
        count: 50
    }

    try {
        const result: IResult = await request(v2API, query, vars, headers);
        // console.log(result.mods, filter)
        return result.mods;
    }
    catch(err) {
        const error = new NexusGQLError(err as any, 'mods');
        // logger.error('Error in latestmods v2 request', error, true);
        throw error;
        // return { nodes: [], totalCount: 0 };
    }
}