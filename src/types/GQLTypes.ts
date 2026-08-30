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

interface Game {
    availableTags: Partial<Tag>[];
    collectionCount: number;
    domainName: string;
    id: number;
    name: string;
    specificTags: Partial<Tag>[];
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

export { ICollectionsFilter, CollectionsSort };