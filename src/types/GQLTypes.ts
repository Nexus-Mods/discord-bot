import { Base, GuildMember } from "discord.js";

type ID = number | string | bigint;
type ModStatus = 'under_moderation' | 'published' | 'not_published' | 'publish_with_game' | 'removed' | 'wastebinned' | 'hidden';


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

interface FeedMod extends Mod {
    // Used on Gamefeeds where we append the Discord account to the object
    authorDiscord?: GuildMember | null;
    // Add the latest file update time from the v1 API response. 
    lastFileUpdate?: number;
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

type FilterComparisonOperator = 'EQUALS' | 'NOT_EQUALS' | 'MATCHES' | 'WILDCARD';
type FilterLogicalOperator = 'AND' | 'OR';

interface BaseFilterValue {
    value: string;
    op: FilterComparisonOperator;
}

interface BooleanFilterValue {
    value: boolean;
    op: FilterComparisonOperator;
}

type CollectionsSortBy = 'listed_at' | 'endorsements_count' | 'latest_published_revision_rating' | 
    'total_downloads'| 'published_at'| 'name.keyword'| 'created_at'| 'updated_at'| 'recent_rating'| 'overall_rating';

interface CollectionsFilter {
    filter?: CollectionsFilter;
    op?: FilterLogicalOperator;
    name?: BaseFilterValue;
    collectionRating?: BaseFilterValue;
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

export { Mod, Game, User, Tag, FeedMod, Collection, CollectionPage, CollectionsFilter, CollectionsSortBy };