import * as Types from './types.js';

export type DiscordBotGetCollectionDataQueryVariables = Types.Exact<{
  slug?: Types.InputMaybe<Types.Scalars['String']['input']>;
  adult?: Types.InputMaybe<Types.Scalars['Boolean']['input']>;
  domain?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type DiscordBotGetCollectionDataQuery = { collection: { id: number, slug: string, name: string, summary: string, adultContent: boolean | null, collectionStatus: Types.CollectionStatus | null, overallRating: string | null, overallRatingCount: number | null, endorsements: number, totalDownloads: number, draftRevisionNumber: number | null, lastPublishedAt: string | null, category: { name: string } | null, latestPublishedRevision: { revisionNumber: number, fileSize: string, modCount: number, adultContent: boolean, updatedAt: string } | null, game: { id: number, domainName: string, name: string }, user: { memberId: number, avatar: string, name: string }, tileImage: { url: string, altText: string | null, thumbnailUrl: string } | null } };

export type DiscordBotGetCollectionRevisionDataQueryVariables = Types.Exact<{
  slug?: Types.InputMaybe<Types.Scalars['String']['input']>;
  domain?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type DiscordBotGetCollectionRevisionDataQuery = { collection: { id: number, slug: string, name: string, revisions: Array<{ id: number, revisionNumber: number, fileSize: string, modCount: number, adultContent: boolean, updatedAt: string, status: string, collectionChangelog: { description: string } | null }> } };

export type DiscordBotSearchCollectionsQueryVariables = Types.Exact<{
  filters?: Types.InputMaybe<Types.CollectionsSearchFilter>;
  count?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  sort?: Types.InputMaybe<Array<Types.CollectionsSearchSort> | Types.CollectionsSearchSort>;
}>;


export type DiscordBotSearchCollectionsQuery = { collectionsV2: { nodesCount: number, nodesFilter: string | null, nodes: Array<{ id: number, slug: string, name: string, summary: string, overallRating: string | null, overallRatingCount: number | null, endorsements: number, totalDownloads: number, firstPublishedAt: string | null, updatedAt: string, draftRevisionNumber: number | null, category: { name: string } | null, latestPublishedRevision: { adultContent: boolean, fileSize: string, modCount: number, revisionNumber: number, updatedAt: string } | null, game: { id: number, domainName: string, name: string }, user: { memberId: number, avatar: string, name: string }, tileImage: { url: string, altText: string | null, thumbnailUrl: string } | null }> } };

export type DiscordBotGetTotalDownloadsForCollectionsQueryVariables = Types.Exact<{
  filters?: Types.InputMaybe<Types.CollectionsSearchFilter>;
  offset: Types.Scalars['Int']['input'];
  sort?: Types.InputMaybe<Array<Types.CollectionsSearchSort> | Types.CollectionsSearchSort>;
}>;


export type DiscordBotGetTotalDownloadsForCollectionsQuery = { collectionsV2: { nodesCount: number, nodesFilter: string | null, nodes: Array<{ slug: string, name: string, totalDownloads: number, uniqueDownloads: number, game: { domainName: string, name: string } }> } };

export type DiscordBotUserByIdQueryVariables = Types.Exact<{
  id: Types.Scalars['Int']['input'];
}>;


export type DiscordBotUserByIdQuery = { user: { name: string, memberId: number, avatar: string, recognizedAuthor: boolean, uniqueModDownloads: number, uniqueCollectionDownloads: number, banned: boolean, deleted: boolean } | null };

export type UserByNameQueryVariables = Types.Exact<{
  username: Types.Scalars['String']['input'];
}>;


export type UserByNameQuery = { userByName: { name: string, memberId: number, avatar: string, recognizedAuthor: boolean, uniqueModDownloads: number, uniqueCollectionDownloads: number, banned: boolean, deleted: boolean } | null };

export type DiscordBotGameQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type DiscordBotGameQuery = { game: { id: number, name: string, approvedAt: string | null, domainName: string, collectionCount: number | null } | null };

export type DiscordBotGetModAuthorStatusQueryVariables = Types.Exact<{
  id: Types.Scalars['Int']['input'];
}>;


export type DiscordBotGetModAuthorStatusQuery = { user: { name: string, recognizedAuthor: boolean } | null };

export type DiscordBotLatestModsQueryVariables = Types.Exact<{
  filter?: Types.InputMaybe<Types.ModsFilter>;
  sort?: Types.InputMaybe<Array<Types.ModsSort> | Types.ModsSort>;
  count?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type DiscordBotLatestModsQuery = { mods: { totalCount: number, nodes: Array<{ uid: string, name: string, summary: string, modId: number, createdAt: string, updatedAt: string, description: string, pictureUrl: string | null, game: { domainName: string, name: string, id: number }, uploader: { name: string, memberId: number, joined: string, modCount: number }, mirrors: Array<{ name: string, uri: string | null }> | null }> } };

export type DiscordBotModsQueryVariables = Types.Exact<{
  filter?: Types.InputMaybe<Types.ModsFilter>;
  sort?: Types.InputMaybe<Array<Types.ModsSort> | Types.ModsSort>;
  count?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type DiscordBotModsQuery = { mods: { totalCount: number, nodes: Array<{ uid: string, modId: number, name: string, createdAt: string, updatedAt: string, summary: string, status: string, author: string | null, pictureUrl: string | null, adult: boolean | null, version: string, downloads: number, uploader: { name: string, avatar: string, memberId: number }, modCategory: { name: string } | null, game: { domainName: string, name: string, id: number } }> } };

export type DiscordBotModFilesQueryVariables = Types.Exact<{
  modId: Types.Scalars['ID']['input'];
  gameId: Types.Scalars['ID']['input'];
}>;


export type DiscordBotModFilesQuery = { modFiles: Array<{ uid: string, uri: string, fileId: number, name: string, version: string, category: Types.ModFileCategory, changelogText: Array<string>, date: number, description: string | null, manager: number, scannedV2: Types.VirusScanStatus }> };

export type DiscordBotModsByDomainQueryVariables = Types.Exact<{
  mods: Array<Types.CompositeDomainWithIdInput> | Types.CompositeDomainWithIdInput;
  count: Types.Scalars['Int']['input'];
  offset: Types.Scalars['Int']['input'];
}>;


export type DiscordBotModsByDomainQuery = { legacyModsByDomain: { nodes: Array<{ uid: string, modId: number, name: string, createdAt: string, updatedAt: string, summary: string, description: string, status: string, author: string | null, pictureUrl: string | null, adult: boolean | null, version: string, uploader: { name: string, avatar: string, memberId: number }, modCategory: { name: string } | null, game: { id: number, domainName: string, name: string } }> } };

export type DiscordBotModsByUidQueryVariables = Types.Exact<{
  uids: Array<Types.Scalars['ID']['input']> | Types.Scalars['ID']['input'];
}>;


export type DiscordBotModsByUidQuery = { modsByUid: { totalCount: number, nodes: Array<{ uid: string, modId: number, name: string, createdAt: string, updatedAt: string, summary: string, status: string, author: string | null, pictureUrl: string | null, adult: boolean | null, version: string, downloads: number, uploader: { name: string, avatar: string, memberId: number }, modCategory: { name: string } | null, game: { domainName: string, name: string, id: number } }> } };

export type DiscordBotMyCollectionsQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type DiscordBotMyCollectionsQuery = { myCollections: { nodesCount: number, nodes: Array<{ id: number, slug: string, name: string, summary: string, adultContent: boolean | null, overallRating: string | null, overallRatingCount: number | null, endorsements: number, totalDownloads: number, draftRevisionNumber: number | null, category: { name: string } | null, latestPublishedRevision: { fileSize: string, modCount: number } | null, game: { id: number, domainName: string, name: string }, user: { memberId: number, avatar: string, name: string }, tileImage: { url: string, altText: string | null, thumbnailUrl: string } | null }> } };

export type DiscordBotNewsQueryVariables = Types.Exact<{
  gameId?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type DiscordBotNewsQuery = { news: { nodes: Array<{ id: string, title: string, summary: string, date: any, header: string | null, image: string | null, newsCategory: { name: string }, author: { name: string, avatar: string } }> } };

export type DiscordBotGetUpdatedModsQueryVariables = Types.Exact<{
  filter?: Types.InputMaybe<Types.ModsFilter>;
  sort?: Types.InputMaybe<Array<Types.ModsSort> | Types.ModsSort>;
  count?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type DiscordBotGetUpdatedModsQuery = { mods: { totalCount: number, nodes: Array<{ uid: string, name: string, summary: string, modId: number, createdAt: string, updatedAt: string, description: string, pictureUrl: string | null, game: { domainName: string, name: string, id: number }, uploader: { name: string, memberId: number, joined: string, modCount: number } }> } };

export type DiscordBotUserSearchQueryVariables = Types.Exact<{
  filter?: Types.InputMaybe<Types.UsersSearchFilter>;
  sort?: Types.InputMaybe<Array<Types.UsersSearchSort> | Types.UsersSearchSort>;
}>;


export type DiscordBotUserSearchQuery = { users: { totalCount: number, nodes: Array<{ name: string, memberId: number, avatar: string }> } };
