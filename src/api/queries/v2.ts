import { ClientError } from "graphql-request";
import type {
    DiscordBotGetCollectionDataQuery,
    DiscordBotGetCollectionRevisionDataQuery,
    DiscordBotModFilesQuery,
    DiscordBotModsQuery,
    DiscordBotSearchCollectionsQuery,
} from '../generated/operations.js';
import type { ModsFilter as GeneratedModsFilter, ModsSort as GeneratedModsSort } from '../generated/types.js';


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

export type ICollectionSearchResult = DiscordBotSearchCollectionsQuery['collectionsV2'] & {
    /** Not from the API: the /search command attaches the web search URL for a 'see all' link. */
    searchURL?: string;
};

export type IMod = DiscordBotModsQuery['mods']['nodes'][number];

/**
 * Input types for the mods() query, taken straight from the schema.
 *
 * Every filter field is a list in the SDL. GraphQL coerces a single value into a
 * one-element list, which is why the hand-written version accepted `T | T[]` - but
 * that also let through combinations the schema does not describe (`name` was typed
 * as BaseFilterValue, permitting operators the API rejects for that field). Wrapping
 * at the call site keeps the type identical to the wire contract.
 */
export type IModsSort = GeneratedModsSort;
export type IModsFilter = GeneratedModsFilter;

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

