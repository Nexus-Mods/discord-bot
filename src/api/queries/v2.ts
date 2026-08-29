import { ClientError } from "graphql-request";
import type { DiscordBotGetCollectionRevisionDataQuery, DiscordBotModFilesQuery, DiscordBotSearchCollectionsQuery } from '../generated/operations.js';
import type { DiscordBotGetCollectionDataQuery } from '../generated/operations.js';
import type { DiscordBotModsQuery } from '../generated/operations.js';
import type * as GQLTypes from '../../types/GQLTypes.js';


export const v2API: string = 'https://api.nexusmods.com/v2/graphql';

/**
 * Kept as a const object rather than an enum.
 *
 * codegen emits `CollectionStatus` as a string union (`enumsAsTypes`), and a TypeScript
 * enum is nominally typed - so `CollectionStatus.Listed` from an enum is not assignable
 * to the generated union even though both are the string 'listed'. `as const` keeps the
 * named-member ergonomics while the values stay literals the generated type accepts.
 */
export const CollectionStatus = {
    Listed: 'listed',
    Unlisted: 'unlisted',
    Moderated: 'under_moderation',
    Discarded: 'discarded',
} as const;

export type CollectionStatus = (typeof CollectionStatus)[keyof typeof CollectionStatus];

export type ICollection = DiscordBotGetCollectionDataQuery['collection'];

export type ICollectionRevision = DiscordBotGetCollectionRevisionDataQuery['collection']['revisions'][number];

interface ICollectionChangelog {
    description: string;
}

export type ICollectionSearchResult = DiscordBotSearchCollectionsQuery['collectionsV2'] & {
    /** Not from the API: the /search command attaches the web search URL for a 'see all' link. */
    searchURL?: string;
};

export type IMod = DiscordBotModsQuery['mods']['nodes'][number];

export interface IModsSort {
    relevance?: GQLTypes.BaseSortValue
    name?: GQLTypes.BaseSortValue
    downloads?: GQLTypes.BaseSortValue 
    endorsements?: GQLTypes.BaseSortValue
    random?: { seed: number }
    createdAt?: GQLTypes.BaseSortValue
    updatedAt?: GQLTypes.BaseSortValue
}

export interface IModsFilter {
    filter?: IModsFilter[];
    op?: GQLTypes.FilterLogicalOperator;
    name?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    nameStemmed?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    gameId?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[]; //This is the numerical ID for a game, not the domain. 
    gameDomainName?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    createdAt?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    updatedAt?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    hasUpdated?: GQLTypes.BooleanFilterValue | GQLTypes.BooleanFilterValue[];
    uploaderId?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    adultContent?: GQLTypes.BooleanFilterValue | GQLTypes.BooleanFilterValue[];
    fileSize?: GQLTypes.IntFilterValue | GQLTypes.IntFilterValue[];
    downloads?: GQLTypes.IntFilterValue | GQLTypes.IntFilterValue[];
    endorsements?: GQLTypes.IntFilterValue | GQLTypes.IntFilterValue[];
    tag?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    description?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    author?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    uploader?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    supportsVortex?: GQLTypes.BooleanFilterValue | GQLTypes.BooleanFilterValue[];
    languageName?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    categoryName?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    status?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    gameName?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    primaryImage?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
}

export class NexusGQLError extends Error {
    public code?: number;
    public errors?: string;
    public fullResponse?: any;

    constructor(clientError: ClientError, type: string) {
        super();
        if (!(clientError instanceof ClientError)) return clientError;
        this.code = clientError.response.status;
        if (clientError.response.errors?.[0]?.message.startsWith('<!DOCTYPE html>') ) {
            this.message = 'Request blocked by Cloudflare';
            this.name = 'Cloudflare Error';
        }
        else {
            const query = typeof clientError.request.query === 'string' ? clientError.request.query.replace('\\n', '\n') : clientError.request.query[0].replace('\\n', '\n');
            const variables = clientError.request.variables || {};
            this.errors = clientError.response.errors ? clientError.response.errors.map(e => e.message).join('\n') : JSON.stringify(clientError.message);
            this.message = `GraphQL ${type} request failed. ${this.code ? `\nStatus: ${this.code}` : null}\nQuery: ${query}\nVariables: ${JSON.stringify(variables)}\nErrors: ${this.errors}`;
            this.name = `Request failed ${type}`;
            if (this.code === 401) this.fullResponse = clientError.response;
        }
    }

}

export type VirusScannedStatus = 
    |"NOT_SCANNED" | "QUEUED" | "WAITING_REPORT" | "VERIFIED" 
    | "INTERNALLY_VERIFIED" | "QUARANTINED" | "MANUALLY_VERIFIED"
    | "MOD_DOES_NOT_EXIST" | "FILE_NOT_FOUND" | "REPORT_ERROR" | "TOO_LARGE";

export type IModFile = DiscordBotModFilesQuery['modFiles'][number];

/**
 * A const object rather than an enum, for the reason given on CollectionStatus: codegen
 * emits string unions, and a TypeScript enum member is not assignable to one.
 */
export const ModFileCategory = {
    Main: 'MAIN',
    Update: 'UPDATE',
    Optional: 'OPTIONAL',
    Old: 'OLD_VERSION',
    Misc: 'MISCELLANEOUS',
    Removed: 'REMOVED',
    Archived: 'ARCHIVED',
} as const;

export type ModFileCategory = (typeof ModFileCategory)[keyof typeof ModFileCategory];

