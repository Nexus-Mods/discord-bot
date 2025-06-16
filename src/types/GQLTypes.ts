type ID = number | string | bigint;
export enum ModStatus {
    Moderated = 'under_moderation',
    Published = 'published',
    Draft =  'not_published',
    AwaitingGameApproval = 'publish_with_game',
    RemovedByAuthor = 'removed',
    RemovedByModerator = 'wastebinned',
    Hidden = 'hidden'
}


interface Mod {
    adult: boolean;
    author: string;
    // Possibly redundant? 
    category: string;
    createdAt: string;
    description: string;
    game: Partial<Game>;
    gameId: number;
    id: number;
    ipAddress?: string;
    modCategory: Partial<ModCategory>;
    modId: number;
    name: string;
    pictureUrl: string;
    status: ModStatus;
    summary: string;
    trackingData?: TrackingState;
    uid: ID;  
    updatedAt: string;
    uploader: Partial<User>;
    version: string;
}

interface ModCategory {
    date: number;
    gameId: number;
    id: ID;
    name: string;
    tags: string;
}

interface Game {
    availableTags: Partial<Tag>[];
    collectionCount: number;
    domainName: string;
    id: number;
    name: string;
    specificTags: Partial<Tag>[];
}

interface User {
    avatar: string;
    deleted: boolean;
    dpOptedIn: boolean;
    email: string;
    ipAddress: string;
    kudos: number;
    memberId: number;
    name: string;
    paypal: string;
    posts: number;
    recognizedAuthor: boolean;
}

interface Tag {
    adult: boolean;
    category: TagCategory;
    createdAt: string;
    discardedAt: Date;
    games: Partial<Game>[];
    global: boolean;
    id: ID;
    name: string;
    taggablesCount: number;
    updatedAt: string;
}

interface TagCategory {
    createdAt: Date;
    discardedAt: Date;
    id: ID;
    name: string;
    tags: Partial<Tag>[];
    updatedAt: string;
}

interface TrackingState {
    test: number;
}

/** COLLECTIONS */
type CollectionStatus = 'listed' | 'unlisted' | 'under_moderation';

interface Collection {
    adultContent: boolean;
    allowUserMedia: boolean;
    bugReport: any;
    bugReports: any;
    category: any;
    collectionChangelogs: any[];
    collectionStatus: CollectionStatus;
    commentLink: string;
    comments: any[];
    contentPreviewLink: string;
    createdAt: Date;
    currentRevision: any;
    description: string;
    discardReason: any;
    discardedAt: boolean; //???
    downloadLink: string;
    draftRevisionNumber: number;
    enableDonations: boolean;
    endorsements: number;
    forumTopic: any;
    game: Game;
    gameId: number;
    headerImage: any;
    id: number;
    latestPublishedRevision: any;
    latestPublishedRevisionRating: any;
    listedAt: Date;
    manuallyVerifyMedia: boolean;
    media: any[];
    metadata: any;
    moderations: any[];
    name: string;
    overallRating: string;
    overallRatingCount: number;
    permissions: any[];
    publicRevisions: any[];
    publishedAt: Date;
    recentRating: string;
    recentRatingCount: number;
    revisions: any[];
    slug: string;
    summary: string;
    tags: any[];
    tileImage: any;
    totalDownloads: number;
    uniqueDownloads: number;
    updatedAt: Date;
    user: User;
    userId: number;
}

/** COLLECTIONS SEARCH AND FILTERING */

type FilterComparisonOperator = 'EQUALS' | 'NOT_EQUALS' | 'MATCHES' | 'WILDCARD' | 'GT' | 'GTE' | 'LT' | 'LTE';
export type FilterLogicalOperator = 'AND' | 'OR';

export interface BaseSortValue {
    direction: 'ASC' | 'DESC'
}

export interface BaseFilterValue {
    value: string;
    op: FilterComparisonOperator;
}

export interface BooleanFilterValue {
    value: boolean;
    op: FilterComparisonOperator;
}

export interface IntFilterValue {
    value: number;
    op: FilterComparisonOperator;
}

interface CollectionsSort {
    relevance?: BaseSortValue;
    createdAt?: BaseSortValue;
    updatedAt?: BaseSortValue;
    endorsements?: BaseSortValue;
    downloads?: BaseSortValue;
    rating?: BaseSortValue;
}

interface ICollectionsFilter {
    filter?: ICollectionsFilter[];
    op?: FilterLogicalOperator;
    userId?: BaseFilterValue;
    name?: BaseFilterValue;
    collectionRating?: BaseFilterValue;
    createdAt?: BaseFilterValue;
    updatedAt?: BaseFilterValue;
    collectionStatus?: BaseFilterValue;
    gameId?: BaseFilterValue;
    gameDomain?: BaseFilterValue;
    gameName?: BaseFilterValue;
    categoryId?: BaseFilterValue;
    categoryName?: BaseFilterValue;
    gameVersion?: BaseFilterValue;
    modUid?: BaseFilterValue;
    modName?: BaseFilterValue;
    tag?: BaseFilterValue;
    adultContent?: BooleanFilterValue;
    hasDraftRevision?: BooleanFilterValue;
    hasPublishedRevision?: BooleanFilterValue;
    generalSearch?: BaseFilterValue;
}

interface CollectionPage {
    nodes?: Collection[];
    nodesAggregations?: any[];
    nodesCount?: number;
    nodesFacets?: any[];
    nodesFilter?: string;
    nextURL?: string; //URL to browser the results on the website.
}

export { ICollectionsFilter, CollectionsSort };