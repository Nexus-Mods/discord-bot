import { ClientError } from "graphql-request";
import * as GQLTypes from '../../types/GQLTypes';


export const v2API: string = 'https://api.nexusmods.com/v2/graphql';

export enum CollectionStatus {
    Listed = 'listed',
    Unlisted = 'unlisted',
    Moderated = 'under_moderation',
    Discarded = 'discarded'
}

export interface ICollection {
    id: number;
    slug: string;
    name: string;
    summary: string;
    collectionStatus: CollectionStatus
    category: {
        name: string;
    };
    overallRating: number;
    overallRatingCount: number;
    endorsements: number;
    totalDownloads: number;
    draftRevisionNumber: number;
    lastPublishedAt: string;
    firstPublishedAt: string;
    latestPublishedRevision: {
        fileSize: number;
        modCount: number;
        revisionNumber: number;
        adultContent: boolean;
        updatedAt: string;
    }
    game: {
        id: number;
        domainName: string;
        name: string;
    }
    user: {
        memberId: number;
        avatar: string;
        name: string;
    }
    tileImage: {
        url: string;
        altText: string;
        thumbnailUrl: string;
    }
    updatedAt: string;
}

export interface ICollectionRevision {
    id: number;
    revisionNumber: number;
    fileSize: number;
    modCount: number;
    adultContent: boolean;
    updatedAt: string;
    collectionChangelog: ICollectionChangelog;
    status: 'draft' | 'published' | 'retracted';
}

interface ICollectionChangelog {
    description: string;
}

export interface ICollectionSearchResult {
    nodes: ICollection[];
    nodesFilter: string;
    nodesCount: number;
    searchURL?: string;
}

export interface IMod {
    uid: string;
    modId: number;
    name: string;
    createdAt: string;
    updatedAt: Date;
    summary: string;
    description: string;
    status: GQLTypes.ModStatus;
    downloads: number;
    author: string;
    uploader: {
        name: string;
        avatar: string;
        memberId: number;
        joined: string;
        membershipRoles: string[];
        modCount: number;
    }
    pictureUrl: string;
    modCategory: {
        name: string
    };
    adult: boolean;
    version: string;
    game: {
        id: number;
        domainName: string;
        name: string;
    }
}

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

export interface IModFile {
    uid: string;
    uri: string;
    category: ModFileCategory;
    changelogText: string[];
    date: number;
    fileId: number;
    name: string;
    version: string;
    description: string;
    manager: number;
}

export enum ModFileCategory {
    Main = 'MAIN',
    Update = 'UPDATE',
    Optional = 'OPTIONAL',
    Old = 'OLD_VERSION',
    Misc = 'MISCELLANEOUS',
    Removed = 'REMOVED',
    Archived = 'ARCHIVED'
}