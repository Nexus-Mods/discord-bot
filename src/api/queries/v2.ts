import { ModStatus } from "@nexusmods/nexus-api";
import { GuildMember } from "discord.js";
import { ClientError } from "graphql-request";
import * as GQLTypes from '../../types/GQLTypes';


export const v2API: string = 'https://api.nexusmods.com/v2/graphql';

export interface ICollection {
    id: number;
    slug: string;
    name: string;
    summary: string;
    category: {
        name: string;
    };
    adultContent: boolean;
    overallRating: number;
    overallRatingCount: number;
    endorsements: number;
    totalDownloads: number;
    draftRevisionNumber: number;
    latestPublishedRevision: {
        fileSize: number;
        modCount: number;
        revisionNumber: number;
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
    updatedAt: Date;
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
    status: ModStatus;
    author: string;
    uploader: {
        name: string;
        avatar: string;
        memberId: number;
        joined: string;
        membershipRoles: string[];
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
    // Added by feed manager
    lastFileUpdate?: number;
    authorDiscord?: GuildMember | null;
}

export interface IModsSort {
    relevance?: { direction: GQLTypes.BaseSortValue }
    name?: { direction: GQLTypes.BaseSortValue }
    downloads?: { direction: GQLTypes.BaseSortValue }
    endorsements?: { direction: GQLTypes.BaseSortValue }
    random?: { seed: number }
    createdAt?: { direction: GQLTypes.BaseSortValue }
    updatedAt?: { direction: GQLTypes.BaseSortValue }
}

export interface IModsFilter {
    filter?: IModsFilter[];
    op?: GQLTypes.FilterLogicalOperator;
    name?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    nameStemmed?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    gameId?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[]; //This is the numerical ID for a game, not the domain. 
    createdAt?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    updatedAt?: GQLTypes.BaseFilterValue | GQLTypes.BaseFilterValue[];
    hasUpdated?: GQLTypes.BooleanFilterValue | GQLTypes.BooleanFilterValue[];
}

export class NexusGQLError extends Error {
    public code?: number;

    constructor(clientError: ClientError, type: string) {
        super();
        if (!(clientError instanceof ClientError)) return clientError;
        this.code = clientError.response.status;
        if (clientError.response.errors?.[0]?.message.startsWith('<!DOCTYPE html>') ) {
            this.message = 'Request blocked by Cloudflare';
            this.name = 'Cloudflare Error';
        }
        else {
            this.message = `GraphQL ${type} request failed. ${this.code ? ` Status: ${this.code}` : null} Message: ${clientError.message}`;
            this.name = `Request failed ${type}`;
        }
    }

}