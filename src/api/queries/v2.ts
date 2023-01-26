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
    }
    user: {
        memberId: number;
        avatar: string;
        name: string;
    }
    tileImage: {
        url: string;
        altText: string;
    }
    updatedAt: Date;
}

export interface ICollectionSearchResult {
    nodes: ICollection[];
    nodesFilter: string;
    nodesCount: number;
    searchURL?: string;
}