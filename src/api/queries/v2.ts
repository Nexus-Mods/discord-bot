import { ModStatus } from "@nexusmods/nexus-api";
import { GuildMember } from "discord.js";

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
    createdAt: Date;
    updatedAt: Date;
    summary: string;
    status: ModStatus;
    author: string;
    uploader: {
        name: string;
        avatar: string;
        memberId: number;
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