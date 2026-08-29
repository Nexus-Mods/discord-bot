/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import * as Types from './types.js';

export type BaseFilterValue = {
  op?: FilterComparisonOperator | null | undefined;
  value: string;
};

export type BaseFilterValueEqualsMatches = {
  op?: FilterComparisonOperatorEqualsMatches | null | undefined;
  value: string;
};

export type BaseFilterValueEqualsWildcard = {
  op?: FilterComparisonOperatorEqualsWildcard | null | undefined;
  value: string;
};

export type BaseSortValue = {
  direction: SortDirection;
};

export type BooleanFilterValue = {
  op?: FilterComparisonOperator | null | undefined;
  value: boolean;
};

export type CollectionGeneralSearchFilterValue = {
  op?: FilterComparisonOperator | null | undefined;
  value: string;
};

export type CollectionStatus =
  | 'discarded'
  | 'listed'
  | 'under_moderation'
  | 'unlisted';

export type CollectionsSearchFilter = {
  adultContent?: Array<BooleanFilterValue> | null | undefined;
  badges?: Array<ExistsFilter> | null | undefined;
  categoryId?: Array<BaseFilterValue> | null | undefined;
  categoryName?: Array<BaseFilterValue> | null | undefined;
  collectionRating?: Array<BaseFilterValue> | null | undefined;
  collectionStatus?: Array<BaseFilterValue> | null | undefined;
  createdAt?: Array<BaseFilterValue> | null | undefined;
  filter?: Array<CollectionsSearchFilter> | null | undefined;
  gameDomain?: Array<BaseFilterValue> | null | undefined;
  gameId?: Array<BaseFilterValue> | null | undefined;
  gameName?: Array<BaseFilterValue> | null | undefined;
  gameVersion?: Array<BaseFilterValue> | null | undefined;
  generalSearch?: Array<CollectionGeneralSearchFilterValue> | null | undefined;
  hasDraftRevision?: Array<BooleanFilterValue> | null | undefined;
  hasPublishedRevision?: Array<BooleanFilterValue> | null | undefined;
  modUid?: Array<BaseFilterValue> | null | undefined;
  name?: Array<BaseFilterValue> | null | undefined;
  op?: FilterLogicalOperator | null | undefined;
  recentRating?: Array<FloatFilterValue> | null | undefined;
  recentRatingCount?: Array<IntFilterValue> | null | undefined;
  schemaId?: Array<IntFilterValue> | null | undefined;
  tag?: Array<BaseFilterValue> | null | undefined;
  updatedAt?: Array<BaseFilterValue> | null | undefined;
  userId?: Array<BaseFilterValue> | null | undefined;
};

export type CollectionsSearchSort = {
  createdAt?: BaseSortValue | null | undefined;
  downloads?: BaseSortValue | null | undefined;
  endorsements?: BaseSortValue | null | undefined;
  rating?: BaseSortValue | null | undefined;
  recentRating?: BaseSortValue | null | undefined;
  relevance?: BaseSortValue | null | undefined;
  updatedAt?: BaseSortValue | null | undefined;
};

export type CompositeDomainWithIdInput = {
  gameDomain: string;
  modId: number;
};

export type ExistsFilter = {
  op: FilterComparisonOperatorExists;
};

export type FilterComparisonOperator =
  | 'EQUALS'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'MATCHES'
  | 'NOT_EQUALS'
  | 'WILDCARD';

export type FilterComparisonOperatorEqualsMatches =
  | 'EQUALS'
  | 'MATCHES'
  | 'NOT_EQUALS';

export type FilterComparisonOperatorEqualsWildcard =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'WILDCARD';

export type FilterComparisonOperatorExists =
  | 'EXISTS'
  | 'NOT_EXISTS';

export type FilterLogicalOperator =
  | 'AND'
  | 'OR';

export type FloatFilterValue = {
  op?: FilterComparisonOperator | null | undefined;
  value: number;
};

export type IntFilterValue = {
  op?: FilterComparisonOperator | null | undefined;
  value: number;
};

export type ModFileCategory =
  | 'ARCHIVED'
  | 'MAIN'
  | 'MISCELLANEOUS'
  | 'OLD_VERSION'
  | 'OPTIONAL'
  | 'REMOVED'
  | 'UPDATE';

export type ModsFilter = {
  adultContent?: Array<BooleanFilterValue> | null | undefined;
  author?: Array<BaseFilterValue> | null | undefined;
  categoryName?: Array<BaseFilterValue> | null | undefined;
  createdAt?: Array<BaseFilterValue> | null | undefined;
  description?: Array<BaseFilterValueEqualsMatches> | null | undefined;
  directDownloadEnabled?: Array<BooleanFilterValue> | null | undefined;
  downloads?: Array<IntFilterValue> | null | undefined;
  endorsements?: Array<IntFilterValue> | null | undefined;
  fileSize?: Array<IntFilterValue> | null | undefined;
  filter?: Array<ModsFilter> | null | undefined;
  gameDomainName?: Array<BaseFilterValue> | null | undefined;
  gameId?: Array<BaseFilterValue> | null | undefined;
  gameName?: Array<BaseFilterValue> | null | undefined;
  hasUpdated?: Array<BooleanFilterValue> | null | undefined;
  id?: Array<BaseFilterValue> | null | undefined;
  languageName?: Array<BaseFilterValue> | null | undefined;
  modId?: Array<BaseFilterValue> | null | undefined;
  name?: Array<BaseFilterValueEqualsWildcard> | null | undefined;
  nameStemmed?: Array<BaseFilterValue> | null | undefined;
  op?: FilterLogicalOperator | null | undefined;
  primaryImage?: Array<BaseFilterValue> | null | undefined;
  status?: Array<BaseFilterValue> | null | undefined;
  supportsVortex?: Array<BooleanFilterValue> | null | undefined;
  tag?: Array<BaseFilterValue> | null | undefined;
  updatedAt?: Array<BaseFilterValue> | null | undefined;
  uploader?: Array<BaseFilterValue> | null | undefined;
  uploaderId?: Array<BaseFilterValue> | null | undefined;
};

export type ModsSort = {
  createdAt?: BaseSortValue | null | undefined;
  downloads?: BaseSortValue | null | undefined;
  endorsements?: BaseSortValue | null | undefined;
  lastComment?: BaseSortValue | null | undefined;
  name?: BaseSortValue | null | undefined;
  random?: RandomSortValue | null | undefined;
  relevance?: BaseSortValue | null | undefined;
  size?: BaseSortValue | null | undefined;
  uniqueDownloads?: BaseSortValue | null | undefined;
  updatedAt?: BaseSortValue | null | undefined;
};

export type RandomSortValue = {
  seed?: number | null | undefined;
};

export type SortDirection =
  | 'ASC'
  | 'DESC';

export type UsersSearchFilter = {
  filter?: Array<UsersSearchFilter> | null | undefined;
  nameExact?: Array<BaseFilterValueEqualsMatches> | null | undefined;
  nameWildcard?: Array<BaseFilterValue> | null | undefined;
  op?: FilterLogicalOperator | null | undefined;
};

export type UsersSearchSort = {
  name?: BaseSortValue | null | undefined;
  relevance?: BaseSortValue | null | undefined;
};

export type VirusScanStatus =
  | 'FILE_NOT_FOUND'
  | 'INTERNALLY_VERIFIED'
  | 'MANUALLY_VERIFIED'
  | 'MOD_DOES_NOT_EXIST'
  | 'NOT_SCANNED'
  | 'PARTIAL'
  | 'QUARANTINED'
  | 'QUEUED'
  | 'REPORT_ERROR'
  | 'TOO_LARGE'
  | 'VERIFIED'
  | 'WAITING_REPORT';

export type DiscordBotGetCollectionDataQueryVariables = Exact<{
  slug?: string | null | undefined;
  adult?: boolean | null | undefined;
  domain?: string | null | undefined;
}>;


export type DiscordBotGetCollectionDataQuery = { collection: { id: number, slug: string, name: string, summary: string, adultContent: boolean | null, collectionStatus: Types.CollectionStatus | null, overallRating: string | null, overallRatingCount: number | null, endorsements: number, totalDownloads: number, draftRevisionNumber: number | null, lastPublishedAt: string | null, category: { name: string } | null, latestPublishedRevision: { revisionNumber: number, fileSize: string, modCount: number, adultContent: boolean, updatedAt: string } | null, game: { id: number, domainName: string, name: string }, user: { memberId: number, avatar: string, name: string }, tileImage: { url: string, altText: string | null, thumbnailUrl: string } | null } };

export type DiscordBotGetCollectionRevisionDataQueryVariables = Exact<{
  slug?: string | null | undefined;
  domain?: string | null | undefined;
}>;


export type DiscordBotGetCollectionRevisionDataQuery = { collection: { id: number, slug: string, name: string, revisions: Array<{ id: number, revisionNumber: number, fileSize: string, modCount: number, adultContent: boolean, updatedAt: string, status: string, collectionChangelog: { description: string } | null }> } };

export type DiscordBotSearchCollectionsQueryVariables = Exact<{
  filters?: Types.CollectionsSearchFilter | null | undefined;
  count?: number | null | undefined;
  sort?: Array<Types.CollectionsSearchSort> | Types.CollectionsSearchSort | null | undefined;
}>;


export type DiscordBotSearchCollectionsQuery = { collectionsV2: { nodesCount: number, nodesFilter: string | null, nodes: Array<{ id: number, slug: string, name: string, summary: string, overallRating: string | null, overallRatingCount: number | null, endorsements: number, totalDownloads: number, firstPublishedAt: string | null, updatedAt: string, draftRevisionNumber: number | null, category: { name: string } | null, latestPublishedRevision: { adultContent: boolean, fileSize: string, modCount: number, revisionNumber: number, updatedAt: string } | null, game: { id: number, domainName: string, name: string }, user: { memberId: number, avatar: string, name: string }, tileImage: { url: string, altText: string | null, thumbnailUrl: string } | null }> } };

export type DiscordBotGetTotalDownloadsForCollectionsQueryVariables = Exact<{
  filters?: Types.CollectionsSearchFilter | null | undefined;
  offset: number;
  sort?: Array<Types.CollectionsSearchSort> | Types.CollectionsSearchSort | null | undefined;
}>;


export type DiscordBotGetTotalDownloadsForCollectionsQuery = { collectionsV2: { nodesCount: number, nodesFilter: string | null, nodes: Array<{ slug: string, name: string, totalDownloads: number, uniqueDownloads: number, game: { domainName: string, name: string } }> } };

export type DiscordBotUserByIdQueryVariables = Exact<{
  id: number;
}>;


export type DiscordBotUserByIdQuery = { user: { name: string, memberId: number, avatar: string, recognizedAuthor: boolean, uniqueModDownloads: number, uniqueCollectionDownloads: number, banned: boolean, deleted: boolean } | null };

export type UserByNameQueryVariables = Exact<{
  username: string;
}>;


export type UserByNameQuery = { userByName: { name: string, memberId: number, avatar: string, recognizedAuthor: boolean, uniqueModDownloads: number, uniqueCollectionDownloads: number, banned: boolean, deleted: boolean } | null };

export type DiscordBotGameQueryVariables = Exact<{ [key: string]: never; }>;


export type DiscordBotGameQuery = { game: { id: number, name: string, approvedAt: string | null, domainName: string, collectionCount: number | null } | null };

export type DiscordBotGetModAuthorStatusQueryVariables = Exact<{
  id: number;
}>;


export type DiscordBotGetModAuthorStatusQuery = { user: { name: string, recognizedAuthor: boolean } | null };

export type DiscordBotLatestModsQueryVariables = Exact<{
  filter?: Types.ModsFilter | null | undefined;
  sort?: Array<Types.ModsSort> | Types.ModsSort | null | undefined;
  count?: number | null | undefined;
}>;


export type DiscordBotLatestModsQuery = { mods: { totalCount: number, nodes: Array<{ uid: string, name: string, summary: string, modId: number, createdAt: string, updatedAt: string, description: string, pictureUrl: string | null, game: { domainName: string, name: string, id: number }, uploader: { name: string, memberId: number, joined: string, modCount: number }, mirrors: Array<{ name: string, uri: string | null }> | null }> } };

export type DiscordBotModsQueryVariables = Exact<{
  filter?: Types.ModsFilter | null | undefined;
  sort?: Array<Types.ModsSort> | Types.ModsSort | null | undefined;
  count?: number | null | undefined;
}>;


export type DiscordBotModsQuery = { mods: { totalCount: number, nodes: Array<{ uid: string, modId: number, name: string, createdAt: string, updatedAt: string, summary: string, status: string, author: string | null, pictureUrl: string | null, adult: boolean | null, version: string, downloads: number, uploader: { name: string, avatar: string, memberId: number }, modCategory: { name: string } | null, game: { domainName: string, name: string, id: number } }> } };

export type DiscordBotModFilesQueryVariables = Exact<{
  modId: string;
  gameId: string;
}>;


export type DiscordBotModFilesQuery = { modFiles: Array<{ uid: string, uri: string, fileId: number, name: string, version: string, category: Types.ModFileCategory, changelogText: Array<string>, date: number, description: string | null, manager: number, scannedV2: Types.VirusScanStatus }> };

export type DiscordBotModsByDomainQueryVariables = Exact<{
  mods: Array<Types.CompositeDomainWithIdInput> | Types.CompositeDomainWithIdInput;
  count: number;
  offset: number;
}>;


export type DiscordBotModsByDomainQuery = { legacyModsByDomain: { nodes: Array<{ uid: string, modId: number, name: string, createdAt: string, updatedAt: string, summary: string, description: string, status: string, author: string | null, pictureUrl: string | null, adult: boolean | null, version: string, uploader: { name: string, avatar: string, memberId: number }, modCategory: { name: string } | null, game: { id: number, domainName: string, name: string } }> } };

export type DiscordBotModsByUidQueryVariables = Exact<{
  uids: Array<string> | string;
}>;


export type DiscordBotModsByUidQuery = { modsByUid: { totalCount: number, nodes: Array<{ uid: string, modId: number, name: string, createdAt: string, updatedAt: string, summary: string, status: string, author: string | null, pictureUrl: string | null, adult: boolean | null, version: string, downloads: number, uploader: { name: string, avatar: string, memberId: number }, modCategory: { name: string } | null, game: { domainName: string, name: string, id: number } }> } };

export type DiscordBotMyCollectionsQueryVariables = Exact<{ [key: string]: never; }>;


export type DiscordBotMyCollectionsQuery = { myCollections: { nodesCount: number, nodes: Array<{ id: number, slug: string, name: string, summary: string, adultContent: boolean | null, overallRating: string | null, overallRatingCount: number | null, endorsements: number, totalDownloads: number, draftRevisionNumber: number | null, category: { name: string } | null, latestPublishedRevision: { fileSize: string, modCount: number } | null, game: { id: number, domainName: string, name: string }, user: { memberId: number, avatar: string, name: string }, tileImage: { url: string, altText: string | null, thumbnailUrl: string } | null }> } };

export type DiscordBotNewsQueryVariables = Exact<{
  gameId?: number | null | undefined;
}>;


export type DiscordBotNewsQuery = { news: { nodes: Array<{ id: string, title: string, summary: string, date: unknown, header: string | null, image: string | null, newsCategory: { name: string }, author: { name: string, avatar: string } }> } };

export type DiscordBotGetUpdatedModsQueryVariables = Exact<{
  filter?: Types.ModsFilter | null | undefined;
  sort?: Array<Types.ModsSort> | Types.ModsSort | null | undefined;
  count?: number | null | undefined;
}>;


export type DiscordBotGetUpdatedModsQuery = { mods: { totalCount: number, nodes: Array<{ uid: string, name: string, summary: string, modId: number, createdAt: string, updatedAt: string, description: string, pictureUrl: string | null, game: { domainName: string, name: string, id: number }, uploader: { name: string, memberId: number, joined: string, modCount: number } }> } };

export type DiscordBotUserSearchQueryVariables = Exact<{
  filter?: Types.UsersSearchFilter | null | undefined;
  sort?: Array<Types.UsersSearchSort> | Types.UsersSearchSort | null | undefined;
}>;


export type DiscordBotUserSearchQuery = { users: { totalCount: number, nodes: Array<{ name: string, memberId: number, avatar: string }> } };
