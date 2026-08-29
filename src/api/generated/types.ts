export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigInt: { input: string; output: string; }
  DateTime: { input: string; output: string; }
  ISO8601DateTime: { input: any; output: any; }
  JSON: { input: unknown; output: unknown; }
  Upload: { input: any; output: any; }
};

export type AbstainFromModEndorsementMutationPayload = {
  endorsement: ModEndorsement;
  success: Scalars['Boolean']['output'];
};

export type AcceptModerationFixMutationPayload = {
  moderationFix: ModerationFix;
  success: Scalars['Boolean']['output'];
};

export type AddBadgeToCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type AddFavouriteGameMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type AddHeaderImageToCollectionMutationPayload = {
  image: CollectionImage;
};

export type AddImageToCollectionMutationPayload = {
  image: CollectionImage;
};

export type AddTagToCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type AddTileImageToCollectionMutationPayload = {
  image: CollectionImage;
};

export type AddVideoToCollectionMutationPayload = {
  video: CollectionVideo;
};

export type AgeVerificationId = {
  createdAt: Scalars['DateTime']['output'];
  externalVerificationId: Scalars['String']['output'];
};

export type AgeVerificationInfo = {
  externalVerificationIds: Array<AgeVerificationId>;
  verified: Scalars['Boolean']['output'];
};

export type AmendModerationMutationPayload = {
  moderation: Moderation;
  success: Scalars['Boolean']['output'];
};

export type ApiApplication = {
  active: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  image: Scalars['String']['output'];
  key: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  summary: Scalars['String']['output'];
};

export type ApiKey = Node & {
  applicationId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  userId: Scalars['Int']['output'];
};

export type AppMetric = {
  clientString: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['ISO8601DateTime']['output'];
  entityId: Scalars['String']['output'];
  entityType: Scalars['String']['output'];
  eventType: AppMetricEventType;
  id: Scalars['BigInt']['output'];
  metadata: Maybe<Scalars['JSON']['output']>;
  userId: Maybe<Scalars['BigInt']['output']>;
};

export type AppMetricEntityType =
  | 'collection';

export type AppMetricEventType =
  | 'collection_completed'
  | 'collection_started';

export type ArtworkSchemaV1 = {
  tile: Scalars['String']['output'];
  tileBlurred: Scalars['String']['output'];
};

export type ArtworkSchemaV2 = {
  hero: Scalars['String']['output'];
  thumbnail: Scalars['String']['output'];
  tile: Scalars['String']['output'];
};

export type Attachable = {
  attachments: Maybe<Array<Attachment>>;
};

export type Attachment = Node & {
  filename: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  url: Scalars['String']['output'];
};

export type AverageRating = {
  average: Scalars['Float']['output'];
  positive: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type Badge = {
  automated: Scalars['Boolean']['output'];
  description: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
};

export type BaseFilterValue = {
  op?: InputMaybe<FilterComparisonOperator>;
  value: Scalars['String']['input'];
};

export type BaseFilterValueEqualsMatches = {
  op?: InputMaybe<FilterComparisonOperatorEqualsMatches>;
  value: Scalars['String']['input'];
};

export type BaseFilterValueEqualsWildcard = {
  op?: InputMaybe<FilterComparisonOperatorEqualsWildcard>;
  value: Scalars['String']['input'];
};

export type BaseFilterValueNumeric = {
  op?: InputMaybe<FilterComparisonOperatorNumeric>;
  value: Scalars['String']['input'];
};

export type BaseSortValue = {
  direction: SortDirection;
};

export type BlockModsFromEarningDpMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type BlockTagMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type BlockUserMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type BlockedMod = {
  id: Scalars['String']['output'];
  isBlocked: Scalars['Boolean']['output'];
};

export type BlockedModsPage = {
  nodes: Array<BlockedMod>;
  pageInfo: BlockedModsPageInfo;
};

export type BlockedModsPageInfo = {
  totalCount: Scalars['Int']['output'];
};

export type BooleanFilterValue = {
  op?: InputMaybe<FilterComparisonOperator>;
  value: Scalars['Boolean']['input'];
};

export type BugReportClosureReason =
  | 'none'
  | 'not_a_bug'
  | 'resolved'
  | 'wont_fix';

export type BugReportModerationStatus =
  | 'hidden'
  | 'none';

export type BugReportStatus =
  | 'closed'
  | 'open';

export type Category = {
  approved: Scalars['Boolean']['output'];
  approvedBy: Maybe<Scalars['Int']['output']>;
  categoryGames: Maybe<Array<Game>>;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  discardedAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  parentId: Scalars['Int']['output'];
  suggestedBy: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type ClearCollectionBugReportModerationStatusMutationPayload = {
  collectionBugReport: CollectionBugReport;
};

export type ClearCommentModerationStatusMutationPayload = {
  comment: Comment;
};

export type ClearThreadModerationStatusMutationPayload = {
  commentThread: CommentThread;
};

export type CloseCollectionBugReportMutationPayload = {
  collectionBugReport: CollectionBugReport;
};

export type Collection = {
  /** @deprecated Adult content is now indicated at the revision level */
  adultContent: Maybe<Scalars['Boolean']['output']>;
  allowUserMedia: Maybe<Scalars['Boolean']['output']>;
  badges: Maybe<Array<Badge>>;
  bugReport: CollectionBugReport;
  bugReports: CollectionBugReportConnection;
  category: Maybe<Category>;
  collectionChangelogs: Maybe<Array<CollectionChangelog>>;
  collectionSchemaId: Maybe<Scalars['Int']['output']>;
  collectionStatus: Maybe<CollectionStatus>;
  commentLink: Maybe<Scalars['String']['output']>;
  commentThread: CommentThread;
  createdAt: Scalars['DateTime']['output'];
  /** @deprecated Deprecated in favour of using a 'collectionRevision' query */
  currentRevision: CollectionRevision;
  description: Scalars['String']['output'];
  discardReason: Maybe<CollectionDiscardReason>;
  discardedAt: Maybe<Scalars['DateTime']['output']>;
  draftRevisionNumber: Maybe<Scalars['Int']['output']>;
  editors: Maybe<Array<User>>;
  endorsements: Scalars['Int']['output'];
  firstPublishedAt: Maybe<Scalars['DateTime']['output']>;
  /** @deprecated Use `commentThread` instead. */
  forumTopic: Maybe<ForumTopic>;
  game: Game;
  gameId: Scalars['Int']['output'];
  headerImage: Maybe<CollectionImage>;
  id: Scalars['Int']['output'];
  lastPublishedAt: Maybe<Scalars['DateTime']['output']>;
  latestPublishedRevision: Maybe<CollectionRevision>;
  latestPublishedRevisionRating: Maybe<Scalars['String']['output']>;
  listedAt: Maybe<Scalars['DateTime']['output']>;
  manuallyVerifyMedia: Maybe<Scalars['Boolean']['output']>;
  media: Array<CollectionMediaUnion>;
  metadata: Maybe<CollectionMetadata>;
  moderationJwt: Scalars['String']['output'];
  moderations: Maybe<Array<Moderation>>;
  name: Scalars['String']['output'];
  overallRating: Maybe<Scalars['String']['output']>;
  overallRatingCount: Maybe<Scalars['Int']['output']>;
  permissions: Maybe<Array<Permission>>;
  publicRevisions: Maybe<Array<PublicCollectionRevision>>;
  /** @deprecated Use `last_published_at` instead. */
  publishedAt: Maybe<Scalars['DateTime']['output']>;
  recentRating: Maybe<Scalars['String']['output']>;
  recentRatingCount: Maybe<Scalars['Int']['output']>;
  revisions: Array<CollectionRevision>;
  slug: Scalars['String']['output'];
  summary: Scalars['String']['output'];
  tags: Array<Tag>;
  tileImage: Maybe<CollectionImage>;
  totalDownloads: Scalars['Int']['output'];
  uniqueDownloads: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['Int']['output'];
  /** @deprecated Use `viewerHasIgnored` instead. */
  viewerBlocked: Scalars['Boolean']['output'];
  viewerHasIgnored: Scalars['Boolean']['output'];
  viewerIsBlocked: Maybe<Scalars['Boolean']['output']>;
};


export type CollectionBugReportArgs = {
  bugReportId: Scalars['ID']['input'];
};


export type CollectionBugReportsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  sortDirection?: InputMaybe<Scalars['String']['input']>;
  status: BugReportStatus;
};


export type CollectionCurrentRevisionArgs = {
  revision?: InputMaybe<Scalars['Int']['input']>;
};

export type CollectionBugReport = Attachable & {
  attachments: Maybe<Array<Attachment>>;
  closedAt: Maybe<Scalars['DateTime']['output']>;
  closureReason: Maybe<BugReportClosureReason>;
  collection: Collection;
  collectionRevisionNumber: Scalars['Int']['output'];
  commentThread: CommentThread;
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  hiddenBy: Maybe<User>;
  hiddenInternalReason: Maybe<Scalars['String']['output']>;
  hiddenReason: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  moderationJwt: Scalars['String']['output'];
  moderationStatus: BugReportModerationStatus;
  openedAt: Maybe<Scalars['DateTime']['output']>;
  permissions: Maybe<Array<Permission>>;
  reporter: User;
  status: BugReportStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  viewerHasIgnored: Scalars['Boolean']['output'];
};

export type CollectionBugReportConnection = {
  edges: Maybe<Array<Maybe<CollectionBugReportEdge>>>;
  nodes: Maybe<Array<Maybe<CollectionBugReport>>>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CollectionBugReportEdge = {
  cursor: Scalars['String']['output'];
  node: Maybe<CollectionBugReport>;
};

export type CollectionChangelog = {
  collectionRevisionId: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  revisionNumber: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type CollectionDiscardReason = {
  collectionId: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['Int']['output'];
  reason: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type CollectionGeneralSearchFilterValue = {
  op?: InputMaybe<FilterComparisonOperator>;
  value: Scalars['String']['input'];
};

export type CollectionImage = GloballyIdentifiable & Reorderable & {
  altText: Maybe<Scalars['String']['output']>;
  collection: Collection;
  createdAt: Scalars['DateTime']['output'];
  discardedAt: Maybe<Scalars['DateTime']['output']>;
  globalId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  imageType: ImageTypes;
  order: Scalars['String']['output'];
  revision: Maybe<CollectionRevision>;
  thumbnailUrl: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  url: Scalars['String']['output'];
  user: User;
};


export type CollectionImageThumbnailUrlArgs = {
  size: ThumbnailSize;
};

export type CollectionManifest = {
  info: CollectionManifestInfo;
  mods: Array<CollectionManifestMod>;
};

export type CollectionManifestInfo = {
  author: Scalars['String']['input'];
  authorUrl?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  domainName: Scalars['String']['input'];
  gameVersions?: InputMaybe<Array<Scalars['String']['input']>>;
  name: Scalars['String']['input'];
  summary?: InputMaybe<Scalars['String']['input']>;
};

export type CollectionManifestMod = {
  author?: InputMaybe<Scalars['String']['input']>;
  domainName: Scalars['String']['input'];
  name: Scalars['String']['input'];
  optional: Scalars['Boolean']['input'];
  source: CollectionManifestModSource;
  version: Scalars['String']['input'];
};

export type CollectionManifestModSource = {
  adultContent?: InputMaybe<Scalars['Boolean']['input']>;
  fileExpression?: InputMaybe<Scalars['String']['input']>;
  fileId?: InputMaybe<Scalars['Int']['input']>;
  fileSize?: InputMaybe<Scalars['Int']['input']>;
  logicalFilename?: InputMaybe<Scalars['String']['input']>;
  md5?: InputMaybe<Scalars['String']['input']>;
  modId?: InputMaybe<Scalars['Int']['input']>;
  type: ModSource;
  updatePolicy?: InputMaybe<UpdatePolicy>;
  url?: InputMaybe<Scalars['String']['input']>;
};

export type CollectionMediaUnion = CollectionImage | CollectionVideo;

export type CollectionMetadata = {
  downloadedAt: Maybe<Scalars['DateTime']['output']>;
  endorsementValue: Maybe<Scalars['Int']['output']>;
  latestDownloadedRevisionNumber: Maybe<Scalars['Int']['output']>;
};

export type CollectionPage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<Collection>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type CollectionPayload = {
  adultContent: Scalars['Boolean']['input'];
  collectionManifest: CollectionManifest;
  collectionSchemaId: Scalars['Int']['input'];
};

export type CollectionRevision = {
  adultContent: Scalars['Boolean']['output'];
  assetsSizeBytes: Scalars['BigInt']['output'];
  badges: Array<Badge>;
  collection: Collection;
  collectionChangelog: Maybe<CollectionChangelog>;
  collectionId: Scalars['Int']['output'];
  collectionSchema: CollectionSchema;
  collectionSchemaId: Scalars['Int']['output'];
  contentPreviewLink: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  discardedAt: Maybe<Scalars['DateTime']['output']>;
  downloadLink: Scalars['String']['output'];
  externalResources: Array<ExternalResource>;
  /** @deprecated Use "totalSize" instead. */
  fileSize: Scalars['BigInt']['output'];
  gameVersions: Maybe<Array<GameVersion>>;
  id: Scalars['Int']['output'];
  installationInfo: Maybe<Scalars['String']['output']>;
  latest: Scalars['Boolean']['output'];
  metadata: Maybe<CollectionRevisionMetadata>;
  modAuthors: UserConnection;
  modCount: Scalars['Int']['output'];
  modFiles: Array<CollectionRevisionMod>;
  overallRating: Maybe<Scalars['String']['output']>;
  overallRatingCount: Maybe<Scalars['Int']['output']>;
  /** @deprecated Deprecated in favour of 'overallRating' and 'overallRatingCount' */
  rating: AverageRating;
  retractionReason: Maybe<RetractionReason>;
  /** @deprecated Use "revisionNumber" instead. */
  revision: Scalars['Int']['output'];
  revisionNumber: Scalars['Int']['output'];
  revisionStatus: Scalars['String']['output'];
  status: Scalars['String']['output'];
  totalDownloads: Scalars['Int']['output'];
  totalSize: Scalars['BigInt']['output'];
  uniqueDownloads: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};


export type CollectionRevisionModAuthorsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CollectionRevisionMetadata = {
  downloadedAt: Maybe<Scalars['DateTime']['output']>;
  ratingValue: Maybe<RatingOptions>;
};

export type CollectionRevisionMod = {
  collectionRevisionId: Scalars['Int']['output'];
  file: Maybe<ModFile>;
  fileId: Scalars['Int']['output'];
  gameId: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  optional: Scalars['Boolean']['output'];
  updatePolicy: Scalars['String']['output'];
  version: Scalars['String']['output'];
};

export type CollectionSchema = {
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
};

export type CollectionStatus =
  | 'discarded'
  | 'listed'
  | 'under_moderation'
  | 'unlisted';

export type CollectionVideo = GloballyIdentifiable & Reorderable & {
  collection: Collection;
  createdAt: Scalars['DateTime']['output'];
  discardedAt: Maybe<Scalars['DateTime']['output']>;
  globalId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  order: Scalars['String']['output'];
  revision: Maybe<CollectionRevision>;
  thumbnailUrl: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  url: Scalars['String']['output'];
  user: User;
};

export type CollectionsFacet = {
  adultContent?: InputMaybe<Array<Scalars['String']['input']>>;
  badges?: InputMaybe<Array<Scalars['String']['input']>>;
  categoryName?: InputMaybe<Array<Scalars['String']['input']>>;
  collectionRating?: InputMaybe<Array<Scalars['String']['input']>>;
  collectionStatus?: InputMaybe<Array<Scalars['String']['input']>>;
  gameIds?: InputMaybe<Array<Scalars['String']['input']>>;
  gameName?: InputMaybe<Array<Scalars['String']['input']>>;
  gameVersion?: InputMaybe<Array<Scalars['String']['input']>>;
  schemaId?: InputMaybe<Array<Scalars['String']['input']>>;
  tag?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CollectionsFilter = {
  adultContent?: InputMaybe<Array<BooleanFilterValue>>;
  categoryId?: InputMaybe<Array<BaseFilterValue>>;
  categoryName?: InputMaybe<Array<BaseFilterValue>>;
  collectionRating?: InputMaybe<Array<BaseFilterValue>>;
  collectionStatus?: InputMaybe<Array<BaseFilterValue>>;
  filter?: InputMaybe<Array<CollectionsFilter>>;
  gameDomain?: InputMaybe<Array<BaseFilterValue>>;
  gameId?: InputMaybe<Array<BaseFilterValue>>;
  gameName?: InputMaybe<Array<BaseFilterValue>>;
  gameVersion?: InputMaybe<Array<BaseFilterValue>>;
  generalSearch?: InputMaybe<Array<CollectionGeneralSearchFilterValue>>;
  hasDraftRevision?: InputMaybe<Array<BooleanFilterValue>>;
  hasPublishedRevision?: InputMaybe<Array<BooleanFilterValue>>;
  modUid?: InputMaybe<Array<BaseFilterValue>>;
  name?: InputMaybe<Array<BaseFilterValue>>;
  op?: InputMaybe<FilterLogicalOperator>;
  tag?: InputMaybe<Array<BaseFilterValue>>;
};

export type CollectionsSearchFilter = {
  adultContent?: InputMaybe<Array<BooleanFilterValue>>;
  badges?: InputMaybe<Array<ExistsFilter>>;
  categoryId?: InputMaybe<Array<BaseFilterValue>>;
  categoryName?: InputMaybe<Array<BaseFilterValue>>;
  collectionRating?: InputMaybe<Array<BaseFilterValue>>;
  collectionStatus?: InputMaybe<Array<BaseFilterValue>>;
  createdAt?: InputMaybe<Array<BaseFilterValue>>;
  filter?: InputMaybe<Array<CollectionsSearchFilter>>;
  gameDomain?: InputMaybe<Array<BaseFilterValue>>;
  gameId?: InputMaybe<Array<BaseFilterValue>>;
  gameName?: InputMaybe<Array<BaseFilterValue>>;
  gameVersion?: InputMaybe<Array<BaseFilterValue>>;
  generalSearch?: InputMaybe<Array<CollectionGeneralSearchFilterValue>>;
  hasDraftRevision?: InputMaybe<Array<BooleanFilterValue>>;
  hasPublishedRevision?: InputMaybe<Array<BooleanFilterValue>>;
  modUid?: InputMaybe<Array<BaseFilterValue>>;
  name?: InputMaybe<Array<BaseFilterValue>>;
  op?: InputMaybe<FilterLogicalOperator>;
  recentRating?: InputMaybe<Array<FloatFilterValue>>;
  recentRatingCount?: InputMaybe<Array<IntFilterValue>>;
  schemaId?: InputMaybe<Array<IntFilterValue>>;
  tag?: InputMaybe<Array<BaseFilterValue>>;
  updatedAt?: InputMaybe<Array<BaseFilterValue>>;
  userId?: InputMaybe<Array<BaseFilterValue>>;
};

export type CollectionsSearchSort = {
  createdAt?: InputMaybe<BaseSortValue>;
  downloads?: InputMaybe<BaseSortValue>;
  endorsements?: InputMaybe<BaseSortValue>;
  rating?: InputMaybe<BaseSortValue>;
  recentRating?: InputMaybe<BaseSortValue>;
  relevance?: InputMaybe<BaseSortValue>;
  updatedAt?: InputMaybe<BaseSortValue>;
};

export type Comment = Attachable & {
  attachments: Maybe<Array<Attachment>>;
  body: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  creator: User;
  cursor: Scalars['String']['output'];
  discardedAt: Maybe<Scalars['DateTime']['output']>;
  discardedBy: Maybe<User>;
  hiddenAt: Maybe<Scalars['DateTime']['output']>;
  hiddenBy: Maybe<User>;
  hiddenInternalReason: Maybe<Scalars['String']['output']>;
  hiddenReason: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isDiscarded: Scalars['Boolean']['output'];
  isPinned: Scalars['Boolean']['output'];
  likesCount: Scalars['Int']['output'];
  lockedAt: Maybe<Scalars['DateTime']['output']>;
  lockedBy: Maybe<User>;
  moderatedByAdmin: Scalars['Boolean']['output'];
  moderationJwt: Scalars['String']['output'];
  moderationStatus: CommentModerationStatus;
  parent: Maybe<Comment>;
  pinPriority: Maybe<Scalars['Int']['output']>;
  pinnedBy: Maybe<User>;
  pinnedByAdmin: Scalars['Boolean']['output'];
  replies: CommentConnection;
  revisions: Array<CommentRevision>;
  updatedAt: Scalars['DateTime']['output'];
  viewerHasIgnored: Scalars['Boolean']['output'];
  viewerHasLiked: Scalars['Boolean']['output'];
};


export type CommentRepliesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type CommentConnection = {
  edges: Maybe<Array<Maybe<CommentEdge>>>;
  nodes: Maybe<Array<Maybe<Comment>>>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CommentEdge = {
  cursor: Scalars['String']['output'];
  node: Maybe<Comment>;
};

export type CommentModerationStatus =
  | 'hidden'
  | 'locked'
  | 'none';

export type CommentRevision = Node & {
  body: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type CommentSearchResultConnection = {
  edges: Maybe<Array<Maybe<CommentSearchResultEdge>>>;
  nodes: Maybe<Array<Maybe<Comment>>>;
  pageInfo: PageInfo;
  timeTaken: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type CommentSearchResultEdge = {
  cursor: Scalars['String']['output'];
  node: Maybe<Comment>;
  relevance: Scalars['Float']['output'];
};

export type CommentThread = {
  comments: CommentConnection;
  id: Scalars['ID']['output'];
  lockedAt: Maybe<Scalars['DateTime']['output']>;
  lockedBy: Maybe<User>;
  moderatedByAdmin: Scalars['Boolean']['output'];
  moderationStatus: CommentThreadModerationStatus;
  owner: User;
};


export type CommentThreadCommentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  sortDirection?: InputMaybe<Scalars['String']['input']>;
};

export type CommentThreadModerationStatus =
  | 'locked'
  | 'none';

export type CommentsSearchFilter = {
  filter?: InputMaybe<Array<CommentsSearchFilter>>;
  op?: InputMaybe<FilterLogicalOperator>;
  query?: InputMaybe<Array<BaseFilterValue>>;
  threadId?: InputMaybe<Array<BaseFilterValue>>;
};

export type CommentsSearchSort = {
  relevance?: InputMaybe<BaseSortValue>;
};

export type CompositeDomainWithIdInput = {
  gameDomain: Scalars['String']['input'];
  modId: Scalars['Int']['input'];
};

export type CompositeIdInput = {
  gameId: Scalars['Int']['input'];
  modId: Scalars['Int']['input'];
};

export type CreateApiKeyMutationPayload = {
  apiKey: ApiKey;
  success: Scalars['Boolean']['output'];
};

export type CreateChangelogMutationPayload = {
  changelogId: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
};

export type CreateCollectionBugReportMutationPayload = {
  collectionBugReport: CollectionBugReport;
};

export type CreateCollectionMutationPayload = {
  collection: Collection;
  collectionId: Scalars['Int']['output'];
  revision: CollectionRevision;
  revisionId: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
};

export type CreateCommentMutationPayload = {
  comment: Comment;
};

export type CreateCsamDeletionRequestPayload = {
  csamDeletionRequest: Maybe<CsamDeletionRequest>;
};

export type CreateEndorsementMutationPayload = {
  endorsement: Endorsement;
  success: Scalars['Boolean']['output'];
};

export type CreateMessagePayload = {
  success: Scalars['Boolean']['output'];
};

export type CreateModEndorsementMutationPayload = {
  endorsement: ModEndorsement;
  success: Scalars['Boolean']['output'];
};

export type CreateNoteAboutUserMutationPayload = {
  success: Maybe<Scalars['Boolean']['output']>;
};

export type CreateOrUpdateRevisionMutationPayload = {
  collection: Collection;
  collectionId: Scalars['Int']['output'];
  revision: CollectionRevision;
  revisionId: Scalars['Int']['output'];
  revisionNumber: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
};

export type CreateRatingMutationPayload = {
  averageRating: AverageRating;
  rating: Rating;
  success: Scalars['Boolean']['output'];
};

export type CreateTagMutationPayload = {
  success: Scalars['Boolean']['output'];
  tag: Maybe<Tag>;
};

export type CsamDeletionRequest = {
  createdAt: Scalars['DateTime']['output'];
  csamUrls: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  requesterMemberId: Scalars['ID']['output'];
  status: CsamDeletionRequestStatus;
};

export type CsamDeletionRequestCdnFilePathResult = {
  message: Scalars['String']['input'];
  path: Scalars['String']['input'];
  status: Scalars['String']['input'];
};

export type CsamDeletionRequestCdnResult = {
  hostname: Scalars['String']['input'];
  processedAt: Scalars['DateTime']['input'];
  results: Array<CsamDeletionRequestCdnUrlResult>;
  summary: CsamDeletionRequestCdnSummary;
};

export type CsamDeletionRequestCdnSummary = {
  failed: Scalars['Int']['input'];
  succeeded: Scalars['Int']['input'];
  total: Scalars['Int']['input'];
};

export type CsamDeletionRequestCdnUrlResult = {
  deletedCount: Scalars['Int']['input'];
  failedCount: Scalars['Int']['input'];
  filePaths: Array<CsamDeletionRequestCdnFilePathResult>;
  foundCount: Scalars['Int']['input'];
  message: Scalars['String']['input'];
  success: Scalars['Boolean']['input'];
  url: Scalars['String']['input'];
};

export type CsamDeletionRequestStatus =
  | 'COMPLETED_SUCCESSFULLY'
  | 'COMPLETED_WITH_FAILURES'
  | 'IN_PROGRESS_BACKBLAZE'
  | 'IN_PROGRESS_CDN'
  | 'IN_PROGRESS_CLOUDFLARE_CACHE'
  | 'PENDING';

export type DeleteApiKeyMutationPayload = {
  message: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type DeletePersonalApiKeyMutationPayload = {
  message: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type DiscardCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type DiscardCommentMutationPayload = {
  comment: Comment;
};

export type DiscardRevisionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type DiscardTagMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type DonationReport =
  | 'I20_GAME_ADJUSTED'
  | 'I20_GAME_POOLS'
  | 'UNIQUE_DOWNLOADS';

export type EditCollectionMutationPayload = {
  collection: Collection;
  success: Scalars['Boolean']['output'];
};

export type Endorsement = {
  modelId: Scalars['BigInt']['output'];
  modelType: Scalars['String']['output'];
  status: Scalars['String']['output'];
  userId: Scalars['Int']['output'];
};

export type ExistsFilter = {
  op: FilterComparisonOperatorExists;
};

export type ExternalResource = {
  author: Maybe<Scalars['String']['output']>;
  collectionRevisionId: Scalars['Int']['output'];
  fileExpression: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  /** @deprecated This field is no longer being used */
  instructions: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  optional: Scalars['Boolean']['output'];
  resourceType: Scalars['String']['output'];
  resourceUrl: Maybe<Scalars['String']['output']>;
  version: Maybe<Scalars['String']['output']>;
};

export type ExternalVideo = {
  embedUrl: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  platform: ExternalVideoPlatform;
  thumbnailUrl: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type ExternalVideoPlatform =
  | 'youtube';

export type FileHash = {
  createdAt: Scalars['DateTime']['output'];
  fileName: Scalars['String']['output'];
  fileSize: Scalars['BigInt']['output'];
  fileType: Scalars['String']['output'];
  gameId: Scalars['Int']['output'];
  md5: Scalars['String']['output'];
  modFile: Maybe<ModFile>;
  modFileId: Scalars['Int']['output'];
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

export type FilterComparisonOperatorNumeric =
  | 'EQUALS'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'NOT_EQUALS';

export type FilterLogicalOperator =
  | 'AND'
  | 'OR';

export type FloatFilterValue = {
  op?: InputMaybe<FilterComparisonOperator>;
  value: Scalars['Float']['input'];
};

export type FormalOrInformalWarning =
  | 'FORMAL_WARNING'
  | 'INFORMAL_WARNING';

export type ForumPost = {
  authorId: Scalars['Int']['output'];
  authorName: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  post: Scalars['String']['output'];
  postDate: Scalars['Int']['output'];
  user: User;
};

export type ForumTopic = {
  approved: Scalars['Boolean']['output'];
  description: Scalars['String']['output'];
  forumId: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  pinned: Scalars['Boolean']['output'];
  posts: Maybe<Array<ForumPost>>;
  postsCount: Scalars['Int']['output'];
  state: Scalars['String']['output'];
  title: Scalars['String']['output'];
  titleSeo: Scalars['String']['output'];
  topicUrl: Maybe<Scalars['String']['output']>;
  views: Scalars['Int']['output'];
  visible: Scalars['String']['output'];
};

export type Game = {
  approvedAt: Maybe<Scalars['DateTime']['output']>;
  artworkSchema: Maybe<GameArtworkSchema>;
  availableTags: Maybe<Array<Tag>>;
  collectionCount: Maybe<Scalars['Int']['output']>;
  copyrightedName: Scalars['Boolean']['output'];
  domainName: Scalars['String']['output'];
  downloadCount: Maybe<Scalars['BigInt']['output']>;
  forumUrl: Maybe<Scalars['String']['output']>;
  genre: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  imageCount: Maybe<Scalars['Int']['output']>;
  mediaCount: Maybe<Scalars['Int']['output']>;
  modCount: Maybe<Scalars['Int']['output']>;
  name: Scalars['String']['output'];
  specificTags: Maybe<Array<Tag>>;
  supporterImageCount: Maybe<Scalars['Int']['output']>;
  supportsVortex: Scalars['Boolean']['output'];
  trendingPeriodDays: Scalars['Int']['output'];
  uniqueDownloadCount: Maybe<Scalars['BigInt']['output']>;
  videoCount: Maybe<Scalars['Int']['output']>;
};

export type GameArtwork = {
  schemaV1: ArtworkSchemaV1;
  schemaV2: ArtworkSchemaV2;
};

export type GameArtworkSchema =
  | 'V1'
  | 'V2';

export type GameConnection = {
  edges: Maybe<Array<Maybe<GameEdge>>>;
  nodes: Maybe<Array<Maybe<Game>>>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type GameEdge = {
  cursor: Scalars['String']['output'];
  node: Maybe<Game>;
};

export type GameExpansion = {
  gameId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type GameNameFieldFilterValue = {
  op?: InputMaybe<FilterComparisonOperator>;
  value: Scalars['String']['input'];
};

export type GamePage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<Game>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type GameVersion = {
  id: Scalars['ID']['output'];
  reference: Scalars['String']['output'];
};

export type GamesFacet = {
  genre?: InputMaybe<Array<Scalars['String']['input']>>;
  hasCollections?: InputMaybe<Array<Scalars['String']['input']>>;
  supportsVortex?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type GamesSearchFilter = {
  filter?: InputMaybe<Array<GamesSearchFilter>>;
  name?: InputMaybe<Array<GameNameFieldFilterValue>>;
  op?: InputMaybe<FilterLogicalOperator>;
};

export type GamesSearchSort = {
  approved?: InputMaybe<BaseSortValue>;
  collections?: InputMaybe<BaseSortValue>;
  downloads?: InputMaybe<BaseSortValue>;
  mods?: InputMaybe<BaseSortValue>;
  name?: InputMaybe<BaseSortValue>;
  relevance?: InputMaybe<BaseSortValue>;
};

export type GiveKudosMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type GlobalNotice = {
  content: Scalars['String']['output'];
  date: Scalars['DateTime']['output'];
  staff: User;
};

export type GloballyIdentifiable = {
  globalId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
};

export type HashCheckResult = {
  hashValue: Scalars['String']['output'];
  match: Scalars['Boolean']['output'];
};

export type HideCollectionBugReportMutationPayload = {
  collectionBugReport: CollectionBugReport;
};

export type HideCommentMutationPayload = {
  comment: Comment;
};

export type IgnoreUserMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type Image = Node & {
  adult: Maybe<Scalars['Boolean']['output']>;
  allowComments: Maybe<Scalars['Boolean']['output']>;
  allowRating: Maybe<Scalars['Boolean']['output']>;
  caption: Scalars['String']['output'];
  category: ImageCategory;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  game: Game;
  id: Scalars['ID']['output'];
  mediaStatus: MediaStatus;
  name: Scalars['String']['output'];
  owner: User;
  rating: Scalars['Int']['output'];
  siteUrl: Scalars['String']['output'];
  thumbnailUrl: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  url: Scalars['String']['output'];
  viewerBlocked: Scalars['Boolean']['output'];
  views: Scalars['Int']['output'];
};

export type ImageCategory = {
  date: Maybe<Scalars['Int']['output']>;
  gameId: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type ImageTypes =
  | 'gallery'
  | 'header'
  | 'tile';

export type IntFilterValue = {
  op?: InputMaybe<FilterComparisonOperator>;
  value: Scalars['Int']['input'];
};

export type IssueWarningToUserMutationPayload = {
  success: Maybe<Scalars['Boolean']['output']>;
};

export type LegacyTag = Node & {
  blockable: Scalars['Boolean']['output'];
  games: Maybe<GameConnection>;
  global: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  parentId: Maybe<Scalars['ID']['output']>;
  searchable: Scalars['Boolean']['output'];
};


export type LegacyTagGamesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type LegacyUpdateModerationWarningMutationPayload = {
  success: Maybe<Scalars['Boolean']['output']>;
};

export type LegacyUpdatePreferencesMutationPayload = {
  success: Maybe<Scalars['Boolean']['output']>;
};

export type LegacyUserDonationPreferences = Node & {
  donateAuthorpremium: Scalars['Boolean']['output'];
  donateOwnpremium: Scalars['Boolean']['output'];
  donatePremiumMax: Scalars['Int']['output'];
  donateProfile: Scalars['Boolean']['output'];
  donateStraight: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  paypal: Scalars['String']['output'];
};

export type LikeCommentMutationPayload = {
  comment: Comment;
};

export type ListCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type LockCommentMutationPayload = {
  comment: Comment;
};

export type LockThreadMutationPayload = {
  commentThread: CommentThread;
};

export type MediaFacet = {
  category?: InputMaybe<Array<Scalars['String']['input']>>;
  gameId?: InputMaybe<Array<Scalars['String']['input']>>;
  type?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type MediaGeneralSearchFilterValue = {
  op?: InputMaybe<FilterComparisonOperator>;
  value: Scalars['String']['input'];
};

export type MediaSearchFilter = {
  adultContent?: InputMaybe<Array<BooleanFilterValue>>;
  createdAt?: InputMaybe<Array<BaseFilterValue>>;
  filter?: InputMaybe<Array<MediaSearchFilter>>;
  gameId?: InputMaybe<Array<BaseFilterValue>>;
  gameName?: InputMaybe<Array<BaseFilterValue>>;
  generalSearch?: InputMaybe<Array<MediaGeneralSearchFilterValue>>;
  mediaStatus?: InputMaybe<Array<BaseFilterValue>>;
  op?: InputMaybe<FilterLogicalOperator>;
  owner?: InputMaybe<Array<BaseFilterValue>>;
  type?: InputMaybe<Array<BaseFilterValue>>;
};

export type MediaSearchSort = {
  createdAt?: InputMaybe<BaseSortValue>;
  random?: InputMaybe<RandomSortValue>;
  rating?: InputMaybe<BaseSortValue>;
  views?: InputMaybe<BaseSortValue>;
};

export type MediaStatus =
  | 'hidden'
  | 'published'
  | 'under_moderation';

export type MediaUnion = Image | SupporterImage | Video;

export type MediaUnionPage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<MediaUnion>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type Mod = {
  /** @deprecated Deprecated in favour of `adult_content`. */
  adult: Maybe<Scalars['Boolean']['output']>;
  adultContent: Maybe<Scalars['Boolean']['output']>;
  author: Maybe<Scalars['String']['output']>;
  category: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  directDownloadEnabled: Scalars['Boolean']['output'];
  downloads: Scalars['Int']['output'];
  endorsements: Scalars['Int']['output'];
  fileSize: Maybe<Scalars['Int']['output']>;
  game: Game;
  gameId: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isBlockedFromEarningDp: Maybe<Scalars['Boolean']['output']>;
  legacyModRequirementsEnabled: Scalars['Boolean']['output'];
  mirrors: Maybe<Array<ModMirror>>;
  modCategory: Maybe<ModCategory>;
  modId: Scalars['Int']['output'];
  modRequirements: ModRequirements;
  name: Scalars['String']['output'];
  pictureUrl: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  summary: Scalars['String']['output'];
  supportsVortex: Scalars['Boolean']['output'];
  tags: Array<LegacyTag>;
  thumbnailBlurredUrl: Maybe<Scalars['String']['output']>;
  thumbnailLargeBlurredUrl: Maybe<Scalars['String']['output']>;
  thumbnailLargeUrl: Maybe<Scalars['String']['output']>;
  thumbnailUrl: Maybe<Scalars['String']['output']>;
  uid: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
  uploader: User;
  version: Scalars['String']['output'];
  viewerBlocked: Scalars['Boolean']['output'];
  viewerDownloaded: Maybe<Scalars['DateTime']['output']>;
  viewerEndorsed: Maybe<Scalars['Boolean']['output']>;
  viewerIsBlocked: Maybe<Scalars['Boolean']['output']>;
  viewerTracked: Scalars['Boolean']['output'];
  viewerUpdateAvailable: Maybe<Scalars['Boolean']['output']>;
};


export type ModModRequirementsArgs = {
  skipDisabledRequirements?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ModAffiliation =
  | 'CONTRIBUTOR'
  | 'OWNER';

export type ModAnalyticsByMonthNode = {
  month: Scalars['Int']['output'];
  totalDownloads: Scalars['BigInt']['output'];
  uniqueDownloads: Scalars['BigInt']['output'];
  year: Scalars['Int']['output'];
};

export type ModAnalyticsByMonthPage = {
  nodes: Array<ModAnalyticsByMonthNode>;
  pageInfo: OffsetBasedPageInfo;
  totalDownloads: Scalars['BigInt']['output'];
  totalUniqueDownloads: Scalars['BigInt']['output'];
};

export type ModAnalyticsByMonthSortBy =
  | 'DATE'
  | 'TOTAL_DOWNLOADS'
  | 'UNIQUE_DOWNLOADS';

export type ModAnalyticsForMonthNode = {
  mod: Mod;
  totalDownloads: Scalars['BigInt']['output'];
  uniqueDownloads: Scalars['BigInt']['output'];
};

export type ModAnalyticsForMonthPage = {
  nodes: Array<ModAnalyticsForMonthNode>;
  pageInfo: OffsetBasedPageInfo;
  totalDownloads: Scalars['BigInt']['output'];
  totalUniqueDownloads: Scalars['BigInt']['output'];
};

export type ModAnalyticsForMonthSortBy =
  | 'TOTAL_DOWNLOADS'
  | 'UNIQUE_DOWNLOADS';

export type ModCategory = {
  categoryId: Scalars['Int']['output'];
  date: Maybe<Scalars['Int']['output']>;
  gameId: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  /** @deprecated These tag identifiers are no longer used */
  tags: Maybe<Scalars['String']['output']>;
};

export type ModEndorsement = {
  modUid: Scalars['BigInt']['output'];
  status: Scalars['String']['output'];
  userId: Scalars['Int']['output'];
};

export type ModEndorserConnection = {
  edges: Maybe<Array<Maybe<ModEndorserEdge>>>;
  nodes: Maybe<Array<Maybe<User>>>;
  pageInfo: PageInfo;
};

export type ModEndorserEdge = {
  cursor: Scalars['String']['output'];
  endorsedAt: Scalars['DateTime']['output'];
  node: Maybe<User>;
};

export type ModFile = Node & {
  category: ModFileCategory;
  categoryId: Scalars['Int']['output'];
  changelogText: Array<Scalars['String']['output']>;
  count: Scalars['Int']['output'];
  date: Scalars['Int']['output'];
  description: Maybe<Scalars['String']['output']>;
  fileId: Scalars['Int']['output'];
  game: Game;
  groupId: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  manager: Scalars['Int']['output'];
  mod: Mod;
  modId: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  owner: User;
  primary: Scalars['Int']['output'];
  reportLink: Scalars['String']['output'];
  requirementsAlert: Scalars['Int']['output'];
  scanned: Scalars['Int']['output'];
  scannedV2: VirusScanStatus;
  size: Scalars['Int']['output'];
  sizeInBytes: Maybe<Scalars['BigInt']['output']>;
  totalDownloads: Scalars['Int']['output'];
  uCount: Scalars['Int']['output'];
  uid: Scalars['ID']['output'];
  uniqueDownloads: Scalars['Int']['output'];
  uri: Scalars['String']['output'];
  version: Scalars['String']['output'];
};

export type ModFileCategory =
  | 'ARCHIVED'
  | 'MAIN'
  | 'MISCELLANEOUS'
  | 'OLD_VERSION'
  | 'OPTIONAL'
  | 'REMOVED'
  | 'UPDATE';

export type ModFileContent = {
  fileExtension: Scalars['String']['output'];
  fileId: Scalars['Int']['output'];
  fileName: Scalars['String']['output'];
  filePath: Scalars['String']['output'];
  filePathParts: Array<Scalars['String']['output']>;
  fileSize: Scalars['BigInt']['output'];
  gameId: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  modId: Scalars['Int']['output'];
};

export type ModFileContentPage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<ModFileContent>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type ModFileContentSearchFilter = {
  fileExtensionExact?: InputMaybe<Array<BaseFilterValueEqualsMatches>>;
  fileId?: InputMaybe<Array<IntFilterValue>>;
  fileNameWildcard?: InputMaybe<Array<BaseFilterValueEqualsWildcard>>;
  filePathPartsExact?: InputMaybe<Array<BaseFilterValueEqualsMatches>>;
  filePathWildcard?: InputMaybe<Array<BaseFilterValueEqualsWildcard>>;
  fileSize?: InputMaybe<Array<BaseFilterValueNumeric>>;
  filter?: InputMaybe<Array<ModFileContentSearchFilter>>;
  gameId?: InputMaybe<Array<IntFilterValue>>;
  modId?: InputMaybe<Array<IntFilterValue>>;
  op?: InputMaybe<FilterLogicalOperator>;
};

export type ModFileContentSearchSort = {
  fileId?: InputMaybe<BaseSortValue>;
  gameId?: InputMaybe<BaseSortValue>;
  modId?: InputMaybe<BaseSortValue>;
};

export type ModFilePage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<ModFile>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type ModMirror = {
  count: Maybe<Scalars['Int']['output']>;
  gameId: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  modId: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  totalDownloads: Maybe<Scalars['Int']['output']>;
  uri: Maybe<Scalars['String']['output']>;
};

export type ModPage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<Mod>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type ModRequirement = {
  externalRequirement: Scalars['Boolean']['output'];
  gameId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  modId: Scalars['ID']['output'];
  modName: Scalars['String']['output'];
  notes: Maybe<Scalars['String']['output']>;
  url: Scalars['String']['output'];
};

export type ModRequirementPage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<ModRequirement>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type ModRequirements = {
  dlcRequirements: Array<ModRequirementsDlc>;
  modsRequiringThisMod: ModRequiringPage;
  nexusRequirements: ModRequirementPage;
};


export type ModRequirementsModsRequiringThisModArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type ModRequirementsNexusRequirementsArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type ModRequirementsDlc = {
  gameExpansion: GameExpansion;
  notes: Maybe<Scalars['String']['output']>;
};

export type ModRequiring = {
  externalRequirement: Scalars['Boolean']['output'];
  gameId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  modId: Scalars['ID']['output'];
  modName: Scalars['String']['output'];
  notes: Maybe<Scalars['String']['output']>;
  url: Scalars['String']['output'];
};

export type ModRequiringPage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<ModRequiring>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type ModSource =
  | 'browse'
  | 'bundle'
  | 'direct'
  | 'manual'
  | 'nexus';

export type ModUpload = {
  chunksCurrent: Maybe<Scalars['Int']['output']>;
  chunksTotal: Maybe<Scalars['Int']['output']>;
  claimed: Maybe<Scalars['Boolean']['output']>;
  contentPreviewGenerated: Maybe<Scalars['Boolean']['output']>;
  createdAt: Scalars['String']['output'];
  discardedAt: Maybe<Scalars['String']['output']>;
  fileChunksReassembled: Maybe<Scalars['Boolean']['output']>;
  fileId: Maybe<Scalars['Int']['output']>;
  game: Maybe<Game>;
  hasAlternateDataStreams: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['String']['output'];
  internalVirusScanStatus: Maybe<Scalars['Int']['output']>;
  lastError: Maybe<Scalars['String']['output']>;
  magicBytesScanStatus: Maybe<Scalars['Int']['output']>;
  md5: Maybe<Scalars['String']['output']>;
  modFile: Maybe<ModFile>;
  modId: Maybe<Scalars['Int']['output']>;
  processingEngine: Maybe<Scalars['String']['output']>;
  s3UploadComplete: Maybe<Scalars['Boolean']['output']>;
  s3Url: Maybe<Scalars['String']['output']>;
  sha256: Maybe<Scalars['String']['output']>;
  sizeBytes: Maybe<Scalars['String']['output']>;
  status: Maybe<Scalars['String']['output']>;
  systemFileName: Maybe<Scalars['String']['output']>;
  tempFileName: Scalars['String']['output'];
  temporalWorkflowUrl: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
  uploadType: Maybe<Scalars['String']['output']>;
  user: Maybe<User>;
  virusTotalChunkScans: Maybe<Array<VirusTotalChunkScan>>;
  virusTotalPositives: Maybe<Scalars['Int']['output']>;
  virusTotalStatus: Maybe<Scalars['Int']['output']>;
  virusTotalUrl: Maybe<Scalars['String']['output']>;
  yaraScanStatus: Maybe<Scalars['Int']['output']>;
};

export type Moderatable =
  | 'Collection';

export type ModerateMutationPayload = {
  moderation: Moderation;
  success: Scalars['Boolean']['output'];
};

export type Moderation = {
  createdAt: Scalars['DateTime']['output'];
  editable: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  moderatableId: Scalars['ID']['output'];
  moderatableType: Moderatable;
  moderationFixes: Maybe<Array<ModerationFix>>;
  moderationReason: ModerationReason;
  staffId: Scalars['ID']['output'];
  staffNote: Maybe<Scalars['String']['output']>;
  unlockedAt: Maybe<Scalars['DateTime']['output']>;
  unlockedBy: Maybe<Scalars['ID']['output']>;
  unlockedNote: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userNote: Maybe<Scalars['String']['output']>;
};

export type ModerationFix = {
  author: User;
  authorId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  moderation: Moderation;
  status: ModerationFixStatus;
  updatedAt: Scalars['DateTime']['output'];
};

export type ModerationFixStatus =
  | 'accepted'
  | 'rejected'
  | 'submitted';

export type ModerationReason = {
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  reason: Scalars['String']['output'];
  resolution: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type ModerationRestrictionInput = {
  gameId?: InputMaybe<Scalars['ID']['input']>;
  modId?: InputMaybe<Scalars['ID']['input']>;
  restriction: ModerationRestrictions;
  timeframe: Scalars['Int']['input'];
};

export type ModerationRestrictions =
  | 'ADD_VIDEOS'
  | 'BLOCK_PM'
  | 'COMMENT_FILE'
  | 'ENDORSE_MEDIA'
  | 'ENDORSE_MOD'
  | 'FILE_DOWNLOAD'
  | 'FILE_UPLOAD'
  | 'IMAGE_UPLOAD'
  | 'MOD_TOOLS'
  | 'POST';

export type ModerationWarning = Node & {
  category: ModerationWarningCategoryEnum;
  date: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isRead: Scalars['Boolean']['output'];
  link: Scalars['String']['output'];
  moderationWarningRestrictions: Maybe<ModerationWarningRestrictionConnection>;
  post: Maybe<ForumPost>;
  postId: Maybe<Scalars['ID']['output']>;
  publicReason: Maybe<Scalars['String']['output']>;
  reason: Scalars['String']['output'];
  removedBy: Maybe<Scalars['ID']['output']>;
  removedDate: Maybe<Scalars['Int']['output']>;
  removedReason: Maybe<Scalars['String']['output']>;
  staff: User;
  user: User;
};


export type ModerationWarningModerationWarningRestrictionsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type ModerationWarningCategoryEnum =
  | 'AUTOMATIC_MESSAGE'
  | 'BAN'
  | 'CLOSE_ACCOUNT'
  | 'FORMAL_WARNING'
  | 'INFORMAL_WARNING'
  | 'MANUAL_MESSAGE'
  | 'UNBAN';

export type ModerationWarningConnection = {
  edges: Maybe<Array<Maybe<ModerationWarningEdge>>>;
  nodes: Maybe<Array<Maybe<ModerationWarning>>>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ModerationWarningEdge = {
  cursor: Scalars['String']['output'];
  node: Maybe<ModerationWarning>;
};

export type ModerationWarningRestriction = Node & {
  duration: Scalars['Int']['output'];
  featureId: Maybe<ModerationWarningRestrictionFeatureEnum>;
  id: Scalars['ID']['output'];
};

export type ModerationWarningRestrictionConnection = {
  edges: Maybe<Array<Maybe<ModerationWarningRestrictionEdge>>>;
  nodes: Maybe<Array<Maybe<ModerationWarningRestriction>>>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ModerationWarningRestrictionEdge = {
  cursor: Scalars['String']['output'];
  node: Maybe<ModerationWarningRestriction>;
};

export type ModerationWarningRestrictionFeatureEnum =
  | 'AddVideos'
  | 'BlockPM'
  | 'ChatBan'
  | 'CommentFile'
  | 'EndorseImage'
  | 'EndorseMod'
  | 'EndorseVideos'
  | 'FileDownload'
  | 'FileUpload'
  | 'ImageUpload'
  | 'ModTools'
  | 'Post';

export type ModifyImageForCollectionMutationPayload = {
  image: CollectionImage;
  updated: Scalars['Boolean']['output'];
};

export type ModsFacet = {
  adult?: InputMaybe<Array<Scalars['String']['input']>>;
  categoryName?: InputMaybe<Array<Scalars['String']['input']>>;
  gameDomainName?: InputMaybe<Array<Scalars['String']['input']>>;
  gameId?: InputMaybe<Array<Scalars['String']['input']>>;
  gameName?: InputMaybe<Array<Scalars['String']['input']>>;
  languageName?: InputMaybe<Array<Scalars['String']['input']>>;
  status?: InputMaybe<Array<Scalars['String']['input']>>;
  tag?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type ModsFilter = {
  adultContent?: InputMaybe<Array<BooleanFilterValue>>;
  author?: InputMaybe<Array<BaseFilterValue>>;
  categoryName?: InputMaybe<Array<BaseFilterValue>>;
  createdAt?: InputMaybe<Array<BaseFilterValue>>;
  description?: InputMaybe<Array<BaseFilterValueEqualsMatches>>;
  directDownloadEnabled?: InputMaybe<Array<BooleanFilterValue>>;
  downloads?: InputMaybe<Array<IntFilterValue>>;
  endorsements?: InputMaybe<Array<IntFilterValue>>;
  fileSize?: InputMaybe<Array<IntFilterValue>>;
  filter?: InputMaybe<Array<ModsFilter>>;
  gameDomainName?: InputMaybe<Array<BaseFilterValue>>;
  gameId?: InputMaybe<Array<BaseFilterValue>>;
  gameName?: InputMaybe<Array<BaseFilterValue>>;
  hasUpdated?: InputMaybe<Array<BooleanFilterValue>>;
  id?: InputMaybe<Array<BaseFilterValue>>;
  languageName?: InputMaybe<Array<BaseFilterValue>>;
  modId?: InputMaybe<Array<BaseFilterValue>>;
  name?: InputMaybe<Array<BaseFilterValueEqualsWildcard>>;
  nameStemmed?: InputMaybe<Array<BaseFilterValue>>;
  op?: InputMaybe<FilterLogicalOperator>;
  primaryImage?: InputMaybe<Array<BaseFilterValue>>;
  status?: InputMaybe<Array<BaseFilterValue>>;
  supportsVortex?: InputMaybe<Array<BooleanFilterValue>>;
  tag?: InputMaybe<Array<BaseFilterValue>>;
  updatedAt?: InputMaybe<Array<BaseFilterValue>>;
  uploader?: InputMaybe<Array<BaseFilterValue>>;
  uploaderId?: InputMaybe<Array<BaseFilterValue>>;
};

export type ModsSort = {
  createdAt?: InputMaybe<BaseSortValue>;
  downloads?: InputMaybe<BaseSortValue>;
  endorsements?: InputMaybe<BaseSortValue>;
  lastComment?: InputMaybe<BaseSortValue>;
  name?: InputMaybe<BaseSortValue>;
  random?: InputMaybe<RandomSortValue>;
  relevance?: InputMaybe<BaseSortValue>;
  size?: InputMaybe<BaseSortValue>;
  uniqueDownloads?: InputMaybe<BaseSortValue>;
  updatedAt?: InputMaybe<BaseSortValue>;
};

export type Mutation = {
  abstainFromModEndorsement: Maybe<AbstainFromModEndorsementMutationPayload>;
  acceptModerationFix: Maybe<AcceptModerationFixMutationPayload>;
  addBadgeToCollection: Maybe<AddBadgeToCollectionMutationPayload>;
  addFavouriteGame: Maybe<AddFavouriteGameMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  addHeaderImageToCollection: Maybe<AddHeaderImageToCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  addImageToCollection: Maybe<AddImageToCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  addTagToCollection: Maybe<AddTagToCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  addTileImageToCollection: Maybe<AddTileImageToCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  addVideoToCollection: Maybe<AddVideoToCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  amendModeration: Maybe<AmendModerationMutationPayload>;
  /** @deprecated This mutation will be replaced with ignore_user mutation */
  blockAuthor: Maybe<BlockUserMutationPayload>;
  blockModsFromEarningDp: Maybe<BlockModsFromEarningDpMutationPayload>;
  blockTag: Maybe<BlockTagMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  clearCollectionBugReportModerationStatus: Maybe<ClearCollectionBugReportModerationStatusMutationPayload>;
  clearCommentModerationStatus: Maybe<ClearCommentModerationStatusMutationPayload>;
  clearCommentThreadModerationStatus: Maybe<ClearThreadModerationStatusMutationPayload>;
  closeCollectionBugReport: Maybe<CloseCollectionBugReportMutationPayload>;
  createApiKey: Maybe<CreateApiKeyMutationPayload>;
  createChangelog: Maybe<CreateChangelogMutationPayload>;
  createCollection: Maybe<CreateCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  createCollectionBugReport: Maybe<CreateCollectionBugReportMutationPayload>;
  createComment: Maybe<CreateCommentMutationPayload>;
  createCsamDeletionRequest: Maybe<CreateCsamDeletionRequestPayload>;
  createMessage: Maybe<CreateMessagePayload>;
  createModEndorsement: Maybe<CreateModEndorsementMutationPayload>;
  createNoteAboutUser: Maybe<CreateNoteAboutUserMutationPayload>;
  createOrUpdateRevision: Maybe<CreateOrUpdateRevisionMutationPayload>;
  createTag: Maybe<CreateTagMutationPayload>;
  deleteApiKey: Maybe<DeleteApiKeyMutationPayload>;
  deletePersonalApiKey: Maybe<DeletePersonalApiKeyMutationPayload>;
  discardCollection: Maybe<DiscardCollectionMutationPayload>;
  discardComment: Maybe<DiscardCommentMutationPayload>;
  discardRevision: Maybe<DiscardRevisionMutationPayload>;
  discardTag: Maybe<DiscardTagMutationPayload>;
  editCollection: Maybe<EditCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  endorse: Maybe<CreateEndorsementMutationPayload>;
  giveKudos: Maybe<GiveKudosMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  hideCollectionBugReport: Maybe<HideCollectionBugReportMutationPayload>;
  hideComment: Maybe<HideCommentMutationPayload>;
  ignoreUser: Maybe<IgnoreUserMutationPayload>;
  issueWarningToUser: Maybe<IssueWarningToUserMutationPayload>;
  likeComment: Maybe<LikeCommentMutationPayload>;
  listCollection: Maybe<ListCollectionMutationPayload>;
  lockComment: Maybe<LockCommentMutationPayload>;
  lockCommentThread: Maybe<LockThreadMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  moderate: Maybe<ModerateMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  modifyImageForCollection: Maybe<ModifyImageForCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  openCollectionBugReport: Maybe<OpenCollectionBugReportMutationPayload>;
  pinComment: Maybe<PinCommentMutationPayload>;
  publishRevision: Maybe<PublishRevisionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  rate: Maybe<CreateRatingMutationPayload>;
  rejectModerationFix: Maybe<RejectModerationFixMutationPayload>;
  removeBadgeFromCollection: Maybe<RemoveBadgeFromCollectionMutationPayload>;
  removeCommentLike: Maybe<RemoveCommentLikeMutationPayload>;
  removeFavouriteGame: Maybe<RemoveFavouriteGameMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  removeHeaderImageFromCollection: Maybe<RemoveHeaderImageFromCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  removeImageFromCollection: Maybe<RemoveImageFromCollectionMutationPayload>;
  removeKudos: Maybe<RemoveKudosMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  removeTagFromCollection: Maybe<RemoveTagFromCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  removeTileImageFromCollection: Maybe<RemoveTileImageFromCollectionMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  removeVideoFromCollection: Maybe<RemoveVideoFromCollectionMutationPayload>;
  reorderItem: Maybe<ReorderItemPayload>;
  reorderPinnedComments: Maybe<ReorderPinnedCommentsMutationPayload>;
  replayTemporalArchiveHistory: Maybe<ReplayTemporalArchiveHistoryMutationPayload>;
  replayTemporalWorkflow: Maybe<ReplayTemporalWorkflowMutationPayload>;
  rescanVirusTotal: Maybe<RescanVirusTotalMutationPayload>;
  restartUploadProcessing: Maybe<RestartUploadProcessingMutationPayload>;
  restoreComment: Maybe<RestoreCommentMutationPayload>;
  retractRevision: Maybe<RetractRevisionMutationPayload>;
  startTemporalArchiveSearch: Maybe<StartTemporalArchiveSearchMutationPayload>;
  submitModerationFix: Maybe<SubmitModerationFixMutationPayload>;
  trackAppMetric: Maybe<TrackAppMetricMutationPayload>;
  trackMod: Maybe<TrackModMutationPayload>;
  trackUser: Maybe<TrackUserMutationPayload>;
  unblockAuthor: Maybe<UnblockUserMutationPayload>;
  unblockModsFromEarningDp: Maybe<UnblockModsFromEarningDpMutationPayload>;
  unblockTag: Maybe<UnblockTagMutationPayload>;
  unignoreUser: Maybe<UnignoreUserMutationPayload>;
  unlistCollection: Maybe<UnlistCollectionMutationPayload>;
  unpinComment: Maybe<UnpinCommentMutationPayload>;
  /** @deprecated Legacy Field - this will be removed in a future update. */
  unpublishRevision: Maybe<RetractRevisionMutationPayload>;
  untrackMod: Maybe<UntrackModMutationPayload>;
  untrackUser: Maybe<UntrackUserMutationPayload>;
  updateAboutMe: Maybe<UpdateAboutMeMutationPayload>;
  updateChangelog: Maybe<UpdateChangelogMutationPayload>;
  /** @deprecated This mutation will be replaced using Interfaces and Global IDs */
  updateCollectionBugReport: Maybe<UpdateCollectionBugReportMutationPayload>;
  updateComment: Maybe<UpdateCommentMutationPayload>;
  updateCountry: Maybe<UpdateCountryMutationPayload>;
  updateCsamDeletionRequest: Maybe<UpdateCsamDeletionRequestPayload>;
  updateGame: Maybe<UpdateGameMutationPayload>;
  updateModDirectDownloadEnabled: Maybe<UpdateModDirectDownloadEnabledMutationPayload>;
  updateModerationWarning: Maybe<LegacyUpdateModerationWarningMutationPayload>;
  updatePreferences: Maybe<LegacyUpdatePreferencesMutationPayload>;
  updateRevision: Maybe<UpdateRevisionMutationPayload>;
  updateTag: Maybe<UpdateTagMutationPayload>;
  updateUserDonationPreferences: Maybe<UpdateUserDonationPreferencesPayload>;
  uploadAttachment: Maybe<UploadAttachmentMutationPayload>;
  uploadGameArtworkV2: Maybe<UploadGameArtworkV2MutationPayload>;
  writeFullPageNotificationToUser: Maybe<WriteFullPageNotificationToUserMutationPayload>;
};


export type MutationAbstainFromModEndorsementArgs = {
  modUid: Scalars['String']['input'];
};


export type MutationAcceptModerationFixArgs = {
  moderationFixId: Scalars['ID']['input'];
};


export type MutationAddBadgeToCollectionArgs = {
  badgeId: Scalars['ID']['input'];
  collectionId: Scalars['Int']['input'];
};


export type MutationAddFavouriteGameArgs = {
  gameId: Scalars['ID']['input'];
};


export type MutationAddHeaderImageToCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  image: UploadImageInput;
};


export type MutationAddImageToCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  collectionRevisionId?: InputMaybe<Scalars['ID']['input']>;
  image: UploadImageInput;
};


export type MutationAddTagToCollectionArgs = {
  collectionId: Scalars['Int']['input'];
  tagIds: Array<Scalars['ID']['input']>;
};


export type MutationAddTileImageToCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  image: UploadImageInput;
};


export type MutationAddVideoToCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  collectionRevisionId?: InputMaybe<Scalars['ID']['input']>;
  video: UploadVideoInput;
};


export type MutationAmendModerationArgs = {
  collectionStatus?: InputMaybe<CollectionStatus>;
  editable?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
  moderationReasonId?: InputMaybe<Scalars['ID']['input']>;
  staffNote?: InputMaybe<Scalars['String']['input']>;
  unlocked?: InputMaybe<Scalars['Boolean']['input']>;
  unlockedNote?: InputMaybe<Scalars['String']['input']>;
  userNote?: InputMaybe<Scalars['String']['input']>;
};


export type MutationBlockAuthorArgs = {
  authorId?: InputMaybe<Scalars['ID']['input']>;
  authorName?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
  userName?: InputMaybe<Scalars['String']['input']>;
};


export type MutationBlockModsFromEarningDpArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationBlockTagArgs = {
  tagId: Scalars['ID']['input'];
};


export type MutationClearCollectionBugReportModerationStatusArgs = {
  bugReportId: Scalars['ID']['input'];
};


export type MutationClearCommentModerationStatusArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationClearCommentThreadModerationStatusArgs = {
  commentThreadId: Scalars['ID']['input'];
};


export type MutationCloseCollectionBugReportArgs = {
  bugReportId: Scalars['ID']['input'];
  closureReason: BugReportClosureReason;
};


export type MutationCreateApiKeyArgs = {
  applicationId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationCreateChangelogArgs = {
  description: Scalars['String']['input'];
  revisionId: Scalars['ID']['input'];
};


export type MutationCreateCollectionArgs = {
  collectionData: CollectionPayload;
  uuid: Scalars['String']['input'];
};


export type MutationCreateCollectionBugReportArgs = {
  attachmentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  collectionId: Scalars['ID']['input'];
  collectionRevisionNumber: Scalars['Int']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};


export type MutationCreateCommentArgs = {
  attachmentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  body: Scalars['String']['input'];
  commentThreadId: Scalars['ID']['input'];
  replyToId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationCreateCsamDeletionRequestArgs = {
  csamUrls: Scalars['String']['input'];
};


export type MutationCreateMessageArgs = {
  body: Scalars['String']['input'];
  title: Scalars['String']['input'];
  to: Array<Scalars['Int']['input']>;
};


export type MutationCreateModEndorsementArgs = {
  modUid: Scalars['String']['input'];
};


export type MutationCreateNoteAboutUserArgs = {
  note: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationCreateOrUpdateRevisionArgs = {
  collectionData: CollectionPayload;
  collectionId: Scalars['Int']['input'];
  uuid: Scalars['String']['input'];
};


export type MutationCreateTagArgs = {
  adult?: InputMaybe<Scalars['Boolean']['input']>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  gameIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  global?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
};


export type MutationDeleteApiKeyArgs = {
  applicationId: Scalars['ID']['input'];
};


export type MutationDiscardCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};


export type MutationDiscardCommentArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationDiscardRevisionArgs = {
  collectionId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  revisionNumber: Scalars['Int']['input'];
};


export type MutationDiscardTagArgs = {
  id: Scalars['ID']['input'];
};


export type MutationEditCollectionArgs = {
  allowUserMedia?: InputMaybe<Scalars['Boolean']['input']>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  collectionId: Scalars['Int']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  manuallyVerifyMedia?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  summary?: InputMaybe<Scalars['String']['input']>;
};


export type MutationEndorseArgs = {
  abstain?: InputMaybe<Scalars['Boolean']['input']>;
  modelId: Scalars['Int']['input'];
  modelType: Scalars['String']['input'];
};


export type MutationGiveKudosArgs = {
  kudosUserId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationHideCollectionBugReportArgs = {
  bugReportId: Scalars['ID']['input'];
  internalReason?: InputMaybe<Scalars['String']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
};


export type MutationHideCommentArgs = {
  commentId: Scalars['ID']['input'];
  internalReason?: InputMaybe<Scalars['String']['input']>;
  reason: Scalars['String']['input'];
};


export type MutationIgnoreUserArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
  userName?: InputMaybe<Scalars['String']['input']>;
};


export type MutationIssueWarningToUserArgs = {
  commentId?: InputMaybe<Scalars['ID']['input']>;
  publicReason?: InputMaybe<Scalars['String']['input']>;
  reason: Scalars['String']['input'];
  referenceLinks?: InputMaybe<Array<Scalars['String']['input']>>;
  restrictions?: InputMaybe<Array<ModerationRestrictionInput>>;
  userId: Scalars['ID']['input'];
  warning: FormalOrInformalWarning;
};


export type MutationLikeCommentArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationListCollectionArgs = {
  collectionId: Scalars['Int']['input'];
};


export type MutationLockCommentArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationLockCommentThreadArgs = {
  commentThreadId: Scalars['ID']['input'];
};


export type MutationModerateArgs = {
  editable?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
  moderationReasonId: Scalars['ID']['input'];
  staffNote?: InputMaybe<Scalars['String']['input']>;
  type: Moderatable;
  userNote?: InputMaybe<Scalars['String']['input']>;
};


export type MutationModifyImageForCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  image: UpdateImageInput;
};


export type MutationOpenCollectionBugReportArgs = {
  bugReportId: Scalars['ID']['input'];
};


export type MutationPinCommentArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationPublishRevisionArgs = {
  collectionStatus?: InputMaybe<CollectionStatus>;
  hasAdultResources?: InputMaybe<Scalars['Boolean']['input']>;
  revisionId: Scalars['ID']['input'];
};


export type MutationRateArgs = {
  id: Scalars['ID']['input'];
  rating: RatingOptions;
  type: Ratable;
};


export type MutationRejectModerationFixArgs = {
  moderationFixId: Scalars['ID']['input'];
};


export type MutationRemoveBadgeFromCollectionArgs = {
  badgeId: Scalars['ID']['input'];
  collectionId: Scalars['Int']['input'];
};


export type MutationRemoveCommentLikeArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationRemoveFavouriteGameArgs = {
  gameId: Scalars['ID']['input'];
};


export type MutationRemoveHeaderImageFromCollectionArgs = {
  collectionId: Scalars['ID']['input'];
};


export type MutationRemoveImageFromCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  imageId: Scalars['ID']['input'];
};


export type MutationRemoveKudosArgs = {
  kudosUserId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationRemoveTagFromCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  tagIds: Array<Scalars['ID']['input']>;
};


export type MutationRemoveTileImageFromCollectionArgs = {
  collectionId: Scalars['ID']['input'];
};


export type MutationRemoveVideoFromCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  videoId: Scalars['ID']['input'];
};


export type MutationReorderItemArgs = {
  id: Scalars['ID']['input'];
  location: ReorderLocation;
  targetId: Scalars['ID']['input'];
};


export type MutationReorderPinnedCommentsArgs = {
  commentIds: Array<Scalars['ID']['input']>;
};


export type MutationReplayTemporalArchiveHistoryArgs = {
  historyId: Scalars['ID']['input'];
};


export type MutationReplayTemporalWorkflowArgs = {
  role: TemporalWorkflowRole;
  uploadId: Scalars['ID']['input'];
};


export type MutationRescanVirusTotalArgs = {
  uploadId: Scalars['ID']['input'];
};


export type MutationRestartUploadProcessingArgs = {
  uploadId: Scalars['ID']['input'];
};


export type MutationRestoreCommentArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationRetractRevisionArgs = {
  reason: Scalars['String']['input'];
  revisionId: Scalars['ID']['input'];
};


export type MutationStartTemporalArchiveSearchArgs = {
  closedFrom?: InputMaybe<Scalars['ISO8601DateTime']['input']>;
  closedTo?: InputMaybe<Scalars['ISO8601DateTime']['input']>;
  uploadId: Scalars['ID']['input'];
};


export type MutationSubmitModerationFixArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  moderationId: Scalars['ID']['input'];
};


export type MutationTrackAppMetricArgs = {
  clientString?: InputMaybe<Scalars['String']['input']>;
  entityId: Scalars['String']['input'];
  entityType: AppMetricEntityType;
  eventType: AppMetricEventType;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
};


export type MutationTrackModArgs = {
  modUid: Scalars['ID']['input'];
};


export type MutationTrackUserArgs = {
  trackedUserId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUnblockAuthorArgs = {
  authorId?: InputMaybe<Scalars['ID']['input']>;
  authorName?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
  userName?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUnblockModsFromEarningDpArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUnblockTagArgs = {
  tagId: Scalars['ID']['input'];
};


export type MutationUnignoreUserArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
  userName?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUnlistCollectionArgs = {
  collectionId: Scalars['ID']['input'];
};


export type MutationUnpinCommentArgs = {
  commentId: Scalars['ID']['input'];
};


export type MutationUnpublishRevisionArgs = {
  reason: Scalars['String']['input'];
  revisionId: Scalars['ID']['input'];
};


export type MutationUntrackModArgs = {
  modUid: Scalars['ID']['input'];
};


export type MutationUntrackUserArgs = {
  trackedUserId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUpdateAboutMeArgs = {
  about: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUpdateChangelogArgs = {
  changelogId: Scalars['ID']['input'];
  description: Scalars['String']['input'];
};


export type MutationUpdateCollectionBugReportArgs = {
  attachmentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  bugReportId: Scalars['ID']['input'];
  collectionRevisionNumber?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};


export type MutationUpdateCommentArgs = {
  attachmentIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  body: Scalars['String']['input'];
  commentId: Scalars['ID']['input'];
};


export type MutationUpdateCountryArgs = {
  country?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUpdateCsamDeletionRequestArgs = {
  cdnSecret?: InputMaybe<Scalars['String']['input']>;
  detailedStatus: CsamDeletionRequestCdnResult;
  id: Scalars['Int']['input'];
};


export type MutationUpdateGameArgs = {
  artworkSchema?: InputMaybe<GameArtworkSchema>;
  copyrightedName?: InputMaybe<Scalars['Boolean']['input']>;
  gameId: Scalars['Int']['input'];
};


export type MutationUpdateModDirectDownloadEnabledArgs = {
  directDownloadEnabled: Scalars['Boolean']['input'];
  modUid: Scalars['ID']['input'];
};


export type MutationUpdateModerationWarningArgs = {
  isRead: Scalars['Boolean']['input'];
  moderationWarningId: Scalars['ID']['input'];
};


export type MutationUpdatePreferencesArgs = {
  adult?: InputMaybe<Scalars['Boolean']['input']>;
  adultBlurImages?: InputMaybe<Scalars['Boolean']['input']>;
  bubbleReply?: InputMaybe<Scalars['Boolean']['input']>;
  comments?: InputMaybe<PreferencesCommentsEnum>;
  defaultMediaTab?: InputMaybe<PreferencesDefaultMediaTabEnum>;
  defaultMediaTabTimeRange?: InputMaybe<PreferencesTimeRangeEnum>;
  defaultModsTab?: InputMaybe<PreferencesDefaultModsTabEnum>;
  defaultModsTabTimeRange?: InputMaybe<PreferencesTimeRangeEnum>;
  defaultOrder?: InputMaybe<PreferencesDefaultSortEnum>;
  defaultSearchType?: InputMaybe<PreferencesSearchTypeEnum>;
  defaultSearchView?: InputMaybe<PreferencesDefaultSearchViewEnum>;
  disableProfileActivity?: InputMaybe<Scalars['Boolean']['input']>;
  displayLastActivity?: InputMaybe<Scalars['Boolean']['input']>;
  dlLocation?: InputMaybe<PreferencesDlLocationEnum>;
  download?: InputMaybe<PreferencesDownloadMethodEnum>;
  imageShowcase?: InputMaybe<PreferencesImageShowcaseEnum>;
  marketingEmails?: InputMaybe<Scalars['Boolean']['input']>;
  notificationsActive?: InputMaybe<Scalars['Boolean']['input']>;
  notificationsGameSpecific?: InputMaybe<Scalars['Boolean']['input']>;
  reminder?: InputMaybe<PreferencesReminderEnum>;
  results?: InputMaybe<PreferencesResultsEnum>;
  subfeedsActivityTracked?: InputMaybe<Scalars['Boolean']['input']>;
  subfeedsActivityYour?: InputMaybe<Scalars['Boolean']['input']>;
  subfeedsAuthorTracked?: InputMaybe<Scalars['Boolean']['input']>;
  subfeedsCommentsTracked?: InputMaybe<Scalars['Boolean']['input']>;
  subfeedsCommentsYour?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationUpdateRevisionArgs = {
  adultContent?: InputMaybe<Scalars['Boolean']['input']>;
  installationInfo?: InputMaybe<Scalars['String']['input']>;
  revisionId: Scalars['Int']['input'];
};


export type MutationUpdateTagArgs = {
  adult?: InputMaybe<Scalars['Boolean']['input']>;
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  gameIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  global?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateUserDonationPreferencesArgs = {
  donateAuthorpremium?: InputMaybe<Scalars['Boolean']['input']>;
  donateOwnpremium?: InputMaybe<Scalars['Boolean']['input']>;
  donatePremiumMax?: InputMaybe<Scalars['Int']['input']>;
  donateProfile?: InputMaybe<Scalars['Boolean']['input']>;
  donateStraight?: InputMaybe<Scalars['Boolean']['input']>;
  dpOptedIn?: InputMaybe<Scalars['Boolean']['input']>;
  paypal?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUploadAttachmentArgs = {
  file: Scalars['Upload']['input'];
};


export type MutationUploadGameArtworkV2Args = {
  gameId: Scalars['Int']['input'];
  heroFile?: InputMaybe<Scalars['Upload']['input']>;
  thumbnailFile?: InputMaybe<Scalars['Upload']['input']>;
  tileFile?: InputMaybe<Scalars['Upload']['input']>;
};


export type MutationWriteFullPageNotificationToUserArgs = {
  message: Scalars['String']['input'];
  referenceLinks?: InputMaybe<Array<Scalars['String']['input']>>;
  title: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type News = {
  author: User;
  commentsCount: Scalars['Int']['output'];
  content: Scalars['String']['output'];
  date: Scalars['ISO8601DateTime']['output'];
  games: Array<Game>;
  header: Maybe<Scalars['String']['output']>;
  html: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  image: Maybe<Scalars['String']['output']>;
  newsCategory: NewsCategory;
  sourceName: Maybe<Scalars['String']['output']>;
  sourceUrl: Maybe<Scalars['String']['output']>;
  summary: Scalars['String']['output'];
  title: Scalars['String']['output'];
  uncroppedHeader: Maybe<Scalars['String']['output']>;
  uncroppedImage: Maybe<Scalars['String']['output']>;
};

export type NewsCategory = {
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type NewsCategoryEnum =
  | 'COMPETITIONS'
  | 'FEATURES'
  | 'GAME_NEWS'
  | 'INTERVIEWS'
  | 'MOD_NEWS'
  | 'SITE_NEWS';

export type NewsPage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<News>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type Node = {
  id: Scalars['ID']['output'];
};

export type NodesFacet = {
  count: Scalars['Int']['output'];
  facet: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type OffsetBasedPageInfo = {
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type OpenCollectionBugReportMutationPayload = {
  collectionBugReport: CollectionBugReport;
};

export type OptedInMod = {
  createdAt: Scalars['DateTime']['output'];
  game: Maybe<Game>;
  gameId: Scalars['Int']['output'];
  id: Scalars['Int']['output'];
  mod: Maybe<Mod>;
  modId: Scalars['Int']['output'];
  ratio: Scalars['Float']['output'];
  uploader: Maybe<User>;
  uploaderId: Scalars['Int']['output'];
};

export type OptedInMods = {
  count: Scalars['Int']['output'];
  entries: Array<OptedInMod>;
  user: User;
  userId: Scalars['Int']['output'];
};

export type PageInfo = {
  endCursor: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor: Maybe<Scalars['String']['output']>;
};

export type PaymentEntity = {
  id: Scalars['Int']['output'];
  label: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type Permission = {
  global: Scalars['Boolean']['output'];
  key: Scalars['String']['output'];
};

export type PinCommentMutationPayload = {
  comment: Comment;
};

export type Preference = Node & {
  adult: Scalars['Boolean']['output'];
  adultBlurImages: Scalars['Boolean']['output'];
  bubbleReply: Scalars['Boolean']['output'];
  comments: PreferencesCommentsEnum;
  defaultMediaTab: PreferencesDefaultMediaTabEnum;
  defaultMediaTabTimeRange: PreferencesTimeRangeEnum;
  defaultModsTab: PreferencesDefaultModsTabEnum;
  defaultModsTabTimeRange: PreferencesTimeRangeEnum;
  defaultOrder: PreferencesDefaultSortEnum;
  defaultSearchType: PreferencesSearchTypeEnum;
  defaultSearchView: PreferencesDefaultSearchViewEnum;
  disableProfileActivity: Scalars['Boolean']['output'];
  displayLastActivity: Scalars['Boolean']['output'];
  dlLocation: PreferencesDlLocationEnum;
  download: PreferencesDownloadMethodEnum;
  id: Scalars['ID']['output'];
  imageShowcase: PreferencesImageShowcaseEnum;
  isBlockingContent: Scalars['Boolean']['output'];
  marketingEmails: Scalars['Boolean']['output'];
  notificationsActive: Scalars['Boolean']['output'];
  notificationsGameSpecific: Scalars['Boolean']['output'];
  reminder: PreferencesReminderEnum;
  results: PreferencesResultsEnum;
  subfeedsActivityTracked: Scalars['Boolean']['output'];
  subfeedsActivityYour: Scalars['Boolean']['output'];
  subfeedsAuthorTracked: Scalars['Boolean']['output'];
  subfeedsCommentsTracked: Scalars['Boolean']['output'];
  subfeedsCommentsYour: Scalars['Boolean']['output'];
};

export type PreferencesCommentsEnum =
  | 'COMMENTS_10'
  | 'COMMENTS_20'
  | 'COMMENTS_30'
  | 'COMMENTS_40'
  | 'COMMENTS_50';

export type PreferencesDefaultMediaTabEnum =
  | 'NEW'
  | 'POPULAR'
  | 'RANDOM'
  | 'TRENDING';

export type PreferencesDefaultModsTabEnum =
  | 'NEW'
  | 'POPULAR'
  | 'RANDOM'
  | 'TRENDING'
  | 'UPDATED';

export type PreferencesDefaultSearchViewEnum =
  | 'COMPACT'
  | 'LIST'
  | 'STANDARD';

export type PreferencesDefaultSortEnum =
  | 'BY_AUTHOR_NAME'
  | 'BY_DOWNLOADS'
  | 'BY_ENDORSEMENTS'
  | 'BY_FILE_NAME'
  | 'BY_FILE_SIZE'
  | 'BY_LAST_UPDATED_FILE'
  | 'BY_RECENT_FILES'
  | 'BY_UNIQUE_DOWNLOADS'
  | 'LAST_COMMENT'
  | 'RANDOM_SORTING';

export type PreferencesDlLocationEnum =
  | 'AMSTERDAM'
  | 'CHICAGO'
  | 'LOS_ANGELES'
  | 'MIAMI'
  | 'NEXUS_CDN'
  | 'PRAGUE';

export type PreferencesDownloadMethodEnum =
  | 'POP_UP_BOX'
  | 'SEPARATE_PAGE';

export type PreferencesImageShowcaseEnum =
  | 'CHOOSE_ON_PER_IMAGE_BASIS'
  | 'NOT_SET'
  | 'TURN_OFF_IMAGES'
  | 'TURN_ON_IMAGES';

export type PreferencesReminderEnum =
  | 'DAYS_1'
  | 'DAYS_3'
  | 'DAYS_7'
  | 'DAYS_14'
  | 'DAYS_28'
  | 'NEVER';

export type PreferencesResultsEnum =
  | 'RESULTS_20'
  | 'RESULTS_40'
  | 'RESULTS_60'
  | 'RESULTS_80';

export type PreferencesSearchTypeEnum =
  | 'ALL_CONTENT'
  | 'COLLECTIONS'
  | 'GAMES'
  | 'IMAGES'
  | 'MODS'
  | 'USERS'
  | 'VIDEOS';

export type PreferencesTimeRangeEnum =
  | 'ALL_TIME'
  | 'FOUR_WEEKS'
  | 'ONE_DAY'
  | 'ONE_WEEK'
  | 'ONE_YEAR'
  | 'TWO_WEEKS';

export type PresignedUrl = {
  url: Scalars['String']['output'];
  uuid: Scalars['String']['output'];
};

export type PublicCollectionChangelog = {
  collectionRevisionId: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  revisionNumber: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type PublicCollectionRevision = {
  collectionChangelog: Maybe<PublicCollectionChangelog>;
  createdAt: Scalars['DateTime']['output'];
  discardedAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['Int']['output'];
  overallRating: Maybe<Scalars['String']['output']>;
  overallRatingCount: Maybe<Scalars['Int']['output']>;
  /** @deprecated Deprecated in favour of 'overallRating' and 'overallRatingCount' */
  rating: AverageRating;
  /** @deprecated Use `revision_number` instead. */
  revision: Scalars['Int']['output'];
  revisionNumber: Scalars['Int']['output'];
  revisionStatus: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type PublishRevisionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type Query = {
  ageVerificationInfo: AgeVerificationInfo;
  applications: Maybe<Array<ApiApplication>>;
  badges: Array<Badge>;
  /** @deprecated This endpoint will be replaced with ignored_users */
  blockedAuthors: Maybe<Array<User>>;
  blockedTags: Maybe<Array<LegacyTag>>;
  categories: Maybe<Array<Category>>;
  category: Maybe<Category>;
  collection: Collection;
  collectionGames: Maybe<Array<Game>>;
  collectionRevision: CollectionRevision;
  collectionRevisionUploadUrl: PresignedUrl;
  collectionsV2: CollectionPage;
  comment: Comment;
  commentThread: CommentThread;
  csamDeletionRequests: Array<CsamDeletionRequest>;
  csamHashCheck: Array<HashCheckResult>;
  currentWarnings: UserWarnings;
  externalVideo: ExternalVideo;
  favouriteGames: Maybe<Array<Game>>;
  fileHash: Array<FileHash>;
  fileHashes: Maybe<Array<FileHash>>;
  game: Maybe<Game>;
  gameArtwork: Maybe<GameArtwork>;
  games: GamePage;
  ignoredUsers: Maybe<Array<User>>;
  /** @deprecated This is a legacy endpoint and should not be used. */
  legacyBlockedAuthors: Maybe<Array<User>>;
  legacyMods: ModPage;
  legacyModsByDomain: ModPage;
  legacyTags: Maybe<Array<LegacyTag>>;
  media: MediaUnionPage;
  mod: Mod;
  modEndorsers: ModEndorserConnection;
  modFileContents: ModFileContentPage;
  modFiles: Array<ModFile>;
  modFilesByUid: ModFilePage;
  moderationReason: Maybe<ModerationReason>;
  moderationReasons: Maybe<Array<ModerationReason>>;
  moderationWarnings: Maybe<ModerationWarningConnection>;
  mods: ModPage;
  modsByUid: ModPage;
  /** @deprecated Deprecated- Use collectionsV2. */
  myCollections: CollectionPage;
  news: NewsPage;
  optedInMods: OptedInMods;
  personalApiKey: Maybe<ApiKey>;
  preferences: Maybe<Preference>;
  privateMessageUrl: Maybe<Scalars['String']['output']>;
  requestMediaUploadUrl: PresignedUrl;
  searchComments: CommentSearchResultConnection;
  speedtestUrls: Array<SpeedtestUrl>;
  startAgeVerificationAppealFlow: StartAgeVerificationFlowResponse;
  startAgeVerificationFlow: StartAgeVerificationFlowResponse;
  tag: Maybe<Tag>;
  tagCategories: Maybe<Array<TagCategory>>;
  tagCategory: Maybe<TagCategory>;
  tags: Maybe<Array<Tag>>;
  temporalArchiveSearch: TemporalArchiveSearch;
  temporalWorkflowInspection: TemporalWorkflowInspection;
  temporalWorkflowStatus: TemporalWorkflowStatus;
  transactions: TransactionList;
  uploads: UploadList;
  user: Maybe<User>;
  userByName: Maybe<User>;
  userDonationPreferences: Maybe<LegacyUserDonationPreferences>;
  userMonthlyReport: UserMonthlyReport;
  userMonthlyReportById: UserMonthlyReport;
  userMonthlySummary: UserMonthlySummary;
  users: UserPage;
  /** @deprecated Legacy Query. This endpoint may change or become unstable in future updates. */
  wallets: WalletList;
};


export type QueryAgeVerificationInfoArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryBlockedTagsArgs = {
  excludeAdult?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryCategoriesArgs = {
  gameId?: InputMaybe<Scalars['Int']['input']>;
  global?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCollectionArgs = {
  domainName?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  viewAdultContent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryCollectionRevisionArgs = {
  domainName?: InputMaybe<Scalars['String']['input']>;
  revision?: InputMaybe<Scalars['Int']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  viewAdultContent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryCollectionsV2Args = {
  count?: InputMaybe<Scalars['Int']['input']>;
  facets?: InputMaybe<CollectionsFacet>;
  filter?: InputMaybe<CollectionsSearchFilter>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  postFilter?: InputMaybe<CollectionsSearchFilter>;
  sort?: InputMaybe<Array<CollectionsSearchSort>>;
  viewUserBlockedContent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryCommentArgs = {
  commentId: Scalars['ID']['input'];
};


export type QueryCommentThreadArgs = {
  commentThreadId: Scalars['ID']['input'];
};


export type QueryCsamDeletionRequestsArgs = {
  cdnSecret?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<CsamDeletionRequestStatus>;
};


export type QueryCsamHashCheckArgs = {
  md5Hashes: Array<Scalars['String']['input']>;
};


export type QueryExternalVideoArgs = {
  url: Scalars['String']['input'];
};


export type QueryFileHashArgs = {
  md5: Scalars['String']['input'];
};


export type QueryFileHashesArgs = {
  md5s: Array<Scalars['String']['input']>;
};


export type QueryGameArgs = {
  domainName?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGamesArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  facets?: InputMaybe<GamesFacet>;
  filter?: InputMaybe<GamesSearchFilter>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  postFilter?: InputMaybe<GamesSearchFilter>;
  sort?: InputMaybe<Array<GamesSearchSort>>;
};


export type QueryLegacyModsArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  ids: Array<CompositeIdInput>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLegacyModsByDomainArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  ids: Array<CompositeDomainWithIdInput>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryLegacyTagsArgs = {
  excludeAdult?: InputMaybe<Scalars['Boolean']['input']>;
  gameId?: InputMaybe<Scalars['ID']['input']>;
  onlyAdult?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryMediaArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  facets?: InputMaybe<MediaFacet>;
  filter?: InputMaybe<MediaSearchFilter>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  postFilter?: InputMaybe<MediaSearchFilter>;
  sort?: InputMaybe<Array<MediaSearchSort>>;
  viewUserBlockedContent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryModArgs = {
  gameId: Scalars['ID']['input'];
  modId: Scalars['ID']['input'];
};


export type QueryModEndorsersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  modUid: Scalars['ID']['input'];
};


export type QueryModFileContentsArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<ModFileContentSearchFilter>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Array<ModFileContentSearchSort>>;
};


export type QueryModFilesArgs = {
  gameId: Scalars['ID']['input'];
  modId: Scalars['ID']['input'];
};


export type QueryModFilesByUidArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  uids: Array<Scalars['ID']['input']>;
};


export type QueryModerationReasonArgs = {
  id: Scalars['ID']['input'];
};


export type QueryModerationWarningsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Array<ModerationWarningCategoryEnum>>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryModsArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  facets?: InputMaybe<ModsFacet>;
  filter?: InputMaybe<ModsFilter>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  postFilter?: InputMaybe<ModsFilter>;
  sort?: InputMaybe<Array<ModsSort>>;
  viewUploaderHidden?: InputMaybe<Scalars['Boolean']['input']>;
  viewUserBlockedContent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryModsByUidArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  uids: Array<Scalars['ID']['input']>;
};


export type QueryMyCollectionsArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  facets?: InputMaybe<CollectionsFacet>;
  filter?: InputMaybe<CollectionsFilter>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  postFilter?: InputMaybe<CollectionsFilter>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  sortDirection?: InputMaybe<Scalars['String']['input']>;
  viewAdultContent?: InputMaybe<Scalars['Boolean']['input']>;
  viewUnderModeration?: InputMaybe<Scalars['Boolean']['input']>;
  viewUnlisted?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryNewsArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  gameId?: InputMaybe<Scalars['Int']['input']>;
  newsCategory?: InputMaybe<NewsCategoryEnum>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryOptedInModsArgs = {
  accountId: Scalars['Int']['input'];
};


export type QueryPrivateMessageUrlArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRequestMediaUploadUrlArgs = {
  filename?: InputMaybe<Scalars['String']['input']>;
  mimeType?: InputMaybe<Scalars['String']['input']>;
};


export type QuerySearchCommentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<CommentsSearchFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Array<CommentsSearchSort>>;
};


export type QueryTagArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTagCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTagsArgs = {
  categoryId?: InputMaybe<Scalars['Int']['input']>;
  gameId?: InputMaybe<Scalars['Int']['input']>;
  includeDiscarded?: InputMaybe<Scalars['Boolean']['input']>;
  includeGlobal?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryTemporalArchiveSearchArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTemporalWorkflowInspectionArgs = {
  uploadId: Scalars['ID']['input'];
};


export type QueryTemporalWorkflowStatusArgs = {
  uploadId: Scalars['ID']['input'];
};


export type QueryTransactionsArgs = {
  accountId?: InputMaybe<Scalars['Int']['input']>;
  bankId?: InputMaybe<Scalars['Int']['input']>;
  orderColumn?: InputMaybe<Scalars['String']['input']>;
  orderDir?: InputMaybe<Scalars['String']['input']>;
  perPage?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  start?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryUploadsArgs = {
  fileId?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<Scalars['String']['input']>;
  gameId?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['String']['input']>;
  modId?: InputMaybe<Scalars['Int']['input']>;
  orderColumn: Scalars['String']['input'];
  orderDir: Scalars['String']['input'];
  perPage: Scalars['Int']['input'];
  search?: InputMaybe<Scalars['String']['input']>;
  start: Scalars['Int']['input'];
  uploadType?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryUserArgs = {
  id: Scalars['Int']['input'];
};


export type QueryUserByNameArgs = {
  name: Scalars['String']['input'];
};


export type QueryUserMonthlyReportArgs = {
  accountId: Scalars['Int']['input'];
  month: Scalars['Int']['input'];
  year: Scalars['Int']['input'];
};


export type QueryUserMonthlyReportByIdArgs = {
  accountId: Scalars['Int']['input'];
  reportId: Scalars['Int']['input'];
};


export type QueryUserMonthlySummaryArgs = {
  accountId: Scalars['Int']['input'];
};


export type QueryUsersArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<UsersSearchFilter>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Array<UsersSearchSort>>;
};


export type QueryWalletsArgs = {
  orderColumn?: InputMaybe<Scalars['String']['input']>;
  orderDir?: InputMaybe<Scalars['String']['input']>;
  perPage?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  start?: InputMaybe<Scalars['Int']['input']>;
};

export type RandomSortValue = {
  seed?: InputMaybe<Scalars['Int']['input']>;
};

export type Ratable =
  | 'CollectionRevision'
  | 'Mod';

export type Rating = Node & {
  id: Scalars['ID']['output'];
  modelId: Scalars['Int']['output'];
  modelType: Scalars['String']['output'];
  rating: Scalars['String']['output'];
  userId: Scalars['Int']['output'];
};

export type RatingOptions =
  | 'abstained'
  | 'negative'
  | 'positive';

export type RejectModerationFixMutationPayload = {
  moderationFix: ModerationFix;
  success: Scalars['Boolean']['output'];
};

export type RemoveBadgeFromCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type RemoveCommentLikeMutationPayload = {
  comment: Comment;
};

export type RemoveFavouriteGameMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type RemoveHeaderImageFromCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type RemoveImageFromCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type RemoveKudosMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type RemoveTagFromCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type RemoveTileImageFromCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type RemoveVideoFromCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type ReorderItemPayload = {
  item: Maybe<Reorderable>;
};

export type ReorderLocation =
  | 'AFTER'
  | 'BEFORE';

export type ReorderPinnedCommentsMutationPayload = {
  comments: Array<Comment>;
};

export type Reorderable = {
  order: Scalars['String']['output'];
};

export type ReplayTemporalArchiveHistoryMutationPayload = {
  history: TemporalArchiveSearchHistory;
};

export type ReplayTemporalWorkflowMutationPayload = {
  result: TemporalReplayResult;
};

export type RescanVirusTotalMutationPayload = {
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type RestartUploadProcessingMutationPayload = {
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type RestoreCommentMutationPayload = {
  comment: Comment;
};

export type RetractRevisionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type RetractionReason = {
  collectionRevisionId: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['Int']['output'];
  reason: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type SortDirection =
  | 'ASC'
  | 'DESC';

export type SpeedtestUrl = {
  description: Maybe<Scalars['String']['output']>;
  location: Maybe<Scalars['String']['output']>;
  tag: Maybe<Scalars['String']['output']>;
  title: Maybe<Scalars['String']['output']>;
};

export type StartAgeVerificationFlowResponse = {
  message: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  verificationResult: VerificationResult;
};

export type StartTemporalArchiveSearchMutationPayload = {
  search: TemporalArchiveSearch;
};

export type SubmitModerationFixMutationPayload = {
  moderationFix: ModerationFix;
  success: Scalars['Boolean']['output'];
};

export type SupporterImage = Node & {
  allowComments: Maybe<Scalars['Boolean']['output']>;
  allowRating: Maybe<Scalars['Boolean']['output']>;
  caption: Scalars['String']['output'];
  category: ImageCategory;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  game: Game;
  id: Scalars['ID']['output'];
  mediaStatus: MediaStatus;
  name: Scalars['String']['output'];
  owner: User;
  rating: Scalars['Int']['output'];
  siteUrl: Scalars['String']['output'];
  thumbnailUrl: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  url: Scalars['String']['output'];
  viewerBlocked: Scalars['Boolean']['output'];
  views: Scalars['Int']['output'];
};

export type Tag = {
  adult: Scalars['Boolean']['output'];
  category: Maybe<TagCategory>;
  createdAt: Scalars['DateTime']['output'];
  discardedAt: Maybe<Scalars['DateTime']['output']>;
  games: Maybe<Array<Game>>;
  global: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  taggablesCount: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type TagCategory = {
  createdAt: Scalars['DateTime']['output'];
  discardedAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  tags: Maybe<Array<Tag>>;
  updatedAt: Scalars['DateTime']['output'];
};

export type TemporalArchiveSearch = {
  blobsScanned: Scalars['Int']['output'];
  diagnosticMessage: Maybe<Scalars['String']['output']>;
  errorMessage: Maybe<Scalars['String']['output']>;
  executionsSeen: Scalars['Int']['output'];
  finished: Scalars['Boolean']['output'];
  histories: Array<TemporalArchiveSearchHistory>;
  historiesFound: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  scannedThrough: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  uploadId: Scalars['ID']['output'];
  windowFrom: Scalars['String']['output'];
  windowTo: Scalars['String']['output'];
  workflowIds: Array<Scalars['String']['output']>;
};

export type TemporalArchiveSearchHistory = {
  buildIds: Array<Scalars['String']['output']>;
  closedAt: Maybe<Scalars['String']['output']>;
  closedStatus: Maybe<Scalars['String']['output']>;
  eventCount: Maybe<Scalars['Int']['output']>;
  exportBlobKey: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  latestForRole: Scalars['Boolean']['output'];
  parentInitiatedEventId: Maybe<Scalars['Int']['output']>;
  parentRunId: Maybe<Scalars['String']['output']>;
  rawHistoryJson: Maybe<Scalars['String']['output']>;
  replayFailureMessage: Maybe<Scalars['String']['output']>;
  replayVerdict: Scalars['String']['output'];
  replayWorkflowClass: Maybe<Scalars['String']['output']>;
  replayedAgainstBuildId: Maybe<Scalars['String']['output']>;
  replayedAt: Maybe<Scalars['String']['output']>;
  role: TemporalWorkflowRole;
  runId: Scalars['String']['output'];
  startedAt: Maybe<Scalars['String']['output']>;
  timeline: Maybe<Array<TemporalHistoryEvent>>;
  workflowId: Scalars['String']['output'];
  workflowType: Maybe<Scalars['String']['output']>;
};

export type TemporalHistoryEvent = {
  attributesJson: Maybe<Scalars['String']['output']>;
  category: Scalars['String']['output'];
  childRunId: Maybe<Scalars['String']['output']>;
  childWorkflowId: Maybe<Scalars['String']['output']>;
  eventId: Scalars['Int']['output'];
  eventType: Scalars['String']['output'];
  role: Maybe<TemporalWorkflowRole>;
  summary: Scalars['String']['output'];
  timestamp: Maybe<Scalars['String']['output']>;
  workflowId: Maybe<Scalars['String']['output']>;
};

export type TemporalReplayResult = {
  availableWorkflowTypes: Array<Scalars['String']['output']>;
  failureClass: Maybe<Scalars['String']['output']>;
  failureMessage: Maybe<Scalars['String']['output']>;
  recordedWorkflowType: Maybe<Scalars['String']['output']>;
  replayedAgainstBuildId: Maybe<Scalars['String']['output']>;
  replayedAs: Maybe<Scalars['String']['output']>;
  verdict: Scalars['String']['output'];
};

export type TemporalWorkflowExecution = {
  attempt: Maybe<Scalars['Int']['output']>;
  buildIds: Maybe<Array<Scalars['String']['output']>>;
  closedAt: Maybe<Scalars['String']['output']>;
  currentActivityState: Maybe<Scalars['String']['output']>;
  currentActivityType: Maybe<Scalars['String']['output']>;
  expirationAt: Maybe<Scalars['String']['output']>;
  found: Scalars['Boolean']['output'];
  heartbeatDetail: Maybe<Scalars['String']['output']>;
  historyError: Maybe<Scalars['String']['output']>;
  historyLength: Maybe<Scalars['Int']['output']>;
  lastFailureMessage: Maybe<Scalars['String']['output']>;
  lastHeartbeatAt: Maybe<Scalars['String']['output']>;
  rawHistoryJson: Maybe<Scalars['String']['output']>;
  role: TemporalWorkflowRole;
  runId: Maybe<Scalars['String']['output']>;
  startedAt: Maybe<Scalars['String']['output']>;
  status: Maybe<Scalars['String']['output']>;
  taskQueue: Maybe<Scalars['String']['output']>;
  timeline: Maybe<Array<TemporalHistoryEvent>>;
  uiUrl: Maybe<Scalars['String']['output']>;
  workflowId: Scalars['String']['output'];
  workflowType: Maybe<Scalars['String']['output']>;
};

export type TemporalWorkflowInspection = {
  discoveredChildren: Array<TemporalWorkflowExecution>;
  entityType: Scalars['String']['output'];
  executions: Array<TemporalWorkflowExecution>;
  found: Scalars['Boolean']['output'];
  mergedTimeline: Maybe<Array<TemporalHistoryEvent>>;
  parent: Maybe<TemporalWorkflowExecution>;
  uploadId: Scalars['ID']['output'];
};

export type TemporalWorkflowRole =
  | 'discovered_child'
  | 'parent'
  | 'scan_child'
  | 'unknown';

export type TemporalWorkflowStatus = {
  attempt: Maybe<Scalars['Int']['output']>;
  closedAt: Maybe<Scalars['String']['output']>;
  currentActivityState: Maybe<Scalars['String']['output']>;
  currentActivityType: Maybe<Scalars['String']['output']>;
  expirationAt: Maybe<Scalars['String']['output']>;
  found: Scalars['Boolean']['output'];
  heartbeatDetail: Maybe<Scalars['String']['output']>;
  historyLength: Maybe<Scalars['Int']['output']>;
  lastFailureMessage: Maybe<Scalars['String']['output']>;
  lastHeartbeatAt: Maybe<Scalars['String']['output']>;
  runId: Maybe<Scalars['String']['output']>;
  startedAt: Maybe<Scalars['String']['output']>;
  status: Maybe<Scalars['String']['output']>;
  taskQueue: Maybe<Scalars['String']['output']>;
  workflowId: Scalars['String']['output'];
  workflowType: Maybe<Scalars['String']['output']>;
};

export type ThumbnailSize =
  | 'large'
  | 'med'
  | 'small';

export type TrackAppMetricMutationPayload = {
  appMetric: Maybe<AppMetric>;
  errors: Maybe<Array<Scalars['String']['output']>>;
  success: Scalars['Boolean']['output'];
};

export type TrackModMutationPayload = {
  success: Scalars['Boolean']['output'];
  trackedMod: TrackedMod;
};

export type TrackUserMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type TrackedMod = {
  gameId: Scalars['ID']['output'];
  modId: Scalars['ID']['output'];
  userId: Scalars['ID']['output'];
};

export type Transaction = {
  amount: Scalars['Int']['output'];
  createdAt: Scalars['String']['output'];
  /** @deprecated Use 'creditorEntity' instead */
  creditor: Maybe<Scalars['String']['output']>;
  creditorEntity: Maybe<PaymentEntity>;
  /** @deprecated Use 'debitorEntity' instead */
  debitor: Maybe<Scalars['String']['output']>;
  debitorEntity: Maybe<PaymentEntity>;
  id: Scalars['Int']['output'];
  label: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type TransactionList = {
  filteredCount: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
  transactions: Maybe<Array<Transaction>>;
};

export type UnblockModsFromEarningDpMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UnblockTagMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UnblockUserMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UnignoreUserMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UnlistCollectionMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UnpinCommentMutationPayload = {
  comment: Comment;
};

export type UntrackModMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UntrackUserMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UpdateAboutMeMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UpdateChangelogMutationPayload = {
  changelogId: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
};

export type UpdateCollectionBugReportMutationPayload = {
  collectionBugReport: CollectionBugReport;
};

export type UpdateCommentMutationPayload = {
  comment: Comment;
};

export type UpdateCountryMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UpdateCsamDeletionRequestPayload = {
  csamDeletionRequest: Maybe<CsamDeletionRequest>;
};

export type UpdateGameMutationPayload = {
  success: Scalars['Boolean']['output'];
};

export type UpdateImageInput = {
  altText?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateModDirectDownloadEnabledMutationPayload = {
  mod: Maybe<Mod>;
  success: Scalars['Boolean']['output'];
};

export type UpdatePolicy =
  | 'exact'
  | 'latest'
  | 'prefer';

export type UpdateRevisionMutationPayload = {
  revisionId: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
};

export type UpdateTagMutationPayload = {
  success: Scalars['Boolean']['output'];
  tag: Tag;
};

export type UpdateUserDonationPreferencesPayload = {
  success: Scalars['Boolean']['output'];
  userDonationPreferences: Maybe<LegacyUserDonationPreferences>;
};

export type UploadAttachmentMutationPayload = {
  attachment: Attachment;
};

export type UploadGameArtworkV2MutationPayload = {
  successHero: Scalars['Boolean']['output'];
  successThumbnail: Scalars['Boolean']['output'];
  successTile: Scalars['Boolean']['output'];
};

export type UploadImageInput = {
  altText?: InputMaybe<Scalars['String']['input']>;
  contentType: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UploadList = {
  filteredCount: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
  uploads: Maybe<Array<ModUpload>>;
};

export type UploadVideoInput = {
  url: Scalars['String']['input'];
};

export type User = {
  about: Maybe<Scalars['String']['output']>;
  avatar: Scalars['String']['output'];
  banned: Scalars['Boolean']['output'];
  blockedFromOptingInModsAt: Maybe<Scalars['DateTime']['output']>;
  collectionCount: Scalars['Int']['output'];
  contributedModCount: Scalars['Int']['output'];
  country: Maybe<Scalars['String']['output']>;
  deleted: Scalars['Boolean']['output'];
  donationsEnabled: Scalars['Boolean']['output'];
  dpOptedIn: Scalars['Boolean']['output'];
  email: Scalars['String']['output'];
  endorsementsGiven: Scalars['Int']['output'];
  fullPageNotificationCount: Maybe<Scalars['Int']['output']>;
  hasGivenKudos: Scalars['Boolean']['output'];
  imageCount: Scalars['Int']['output'];
  ipAddress: Maybe<Scalars['String']['output']>;
  isBlocked: Scalars['Boolean']['output'];
  isTracked: Scalars['Boolean']['output'];
  joined: Scalars['DateTime']['output'];
  kudos: Scalars['Int']['output'];
  lastActive: Maybe<Scalars['DateTime']['output']>;
  legacyRoles: Array<Scalars['String']['output']>;
  memberId: Scalars['Int']['output'];
  membershipRoles: Array<Scalars['String']['output']>;
  modAnalyticsByMonth: ModAnalyticsByMonthPage;
  modAnalyticsForMonth: ModAnalyticsForMonthPage;
  modCount: Scalars['Int']['output'];
  moderationHistoryCount: Maybe<Scalars['Int']['output']>;
  moderationJwt: Maybe<Scalars['String']['output']>;
  modsBlockedFromEarningDp: BlockedModsPage;
  name: Scalars['String']['output'];
  ownedModCount: Scalars['Int']['output'];
  paypal: Maybe<Scalars['String']['output']>;
  posts: Scalars['Int']['output'];
  recognizedAuthor: Scalars['Boolean']['output'];
  roles: Array<Scalars['String']['output']>;
  showActivityFeed: Scalars['Boolean']['output'];
  showLastActive: Scalars['Boolean']['output'];
  uniqueCollectionDownloads: Scalars['Int']['output'];
  uniqueModDownloads: Scalars['Int']['output'];
  usernameLastChangedAt: Maybe<Scalars['DateTime']['output']>;
  verifiedCurator: Scalars['Boolean']['output'];
  videoCount: Scalars['Int']['output'];
  viewerHasBlocked: Maybe<Scalars['Boolean']['output']>;
  viewerHasIgnored: Scalars['Boolean']['output'];
  views: Scalars['Int']['output'];
};


export type UserModAnalyticsByMonthArgs = {
  affiliation?: InputMaybe<ModAffiliation>;
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<ModAnalyticsByMonthSortBy>;
  sortDirection?: InputMaybe<SortDirection>;
};


export type UserModAnalyticsForMonthArgs = {
  affiliation?: InputMaybe<ModAffiliation>;
  month: Scalars['Int']['input'];
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<ModAnalyticsForMonthSortBy>;
  sortDirection?: InputMaybe<SortDirection>;
  year: Scalars['Int']['input'];
};


export type UserModsBlockedFromEarningDpArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type UserConnection = {
  edges: Maybe<Array<Maybe<UserEdge>>>;
  nodes: Maybe<Array<Maybe<User>>>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type UserEdge = {
  cursor: Scalars['String']['output'];
  node: Maybe<User>;
};

export type UserMonthlyReport = {
  entries: Array<UserMonthlyReportEntry>;
  reportType: DonationReport;
  user: Maybe<User>;
  userId: Scalars['Int']['output'];
};

export type UserMonthlyReportEntry = {
  author: Maybe<User>;
  authorCount: Maybe<Scalars['Int']['output']>;
  authorId: Maybe<Scalars['Int']['output']>;
  authorValue: Maybe<Scalars['Int']['output']>;
  game: Maybe<Game>;
  gameId: Maybe<Scalars['Int']['output']>;
  mod: Maybe<Mod>;
  modCount: Maybe<Scalars['Int']['output']>;
  modId: Maybe<Scalars['Int']['output']>;
  modValue: Maybe<Scalars['Int']['output']>;
  month: Scalars['Int']['output'];
  ratio: Scalars['Float']['output'];
  reportId: Scalars['Int']['output'];
  status: Scalars['Int']['output'];
  value: Scalars['Int']['output'];
  year: Scalars['Int']['output'];
};

export type UserMonthlySummary = {
  entries: Array<UserMonthlySummaryEntry>;
  user: User;
  userId: Scalars['Int']['output'];
};

export type UserMonthlySummaryEntry = {
  modCount: Scalars['Int']['output'];
  modValue: Scalars['Int']['output'];
  month: Scalars['Int']['output'];
  reportType: DonationReport;
  value: Scalars['Int']['output'];
  year: Scalars['Int']['output'];
};

export type UserPage = {
  facets: Maybe<Array<NodesFacet>>;
  facetsData: Maybe<Scalars['JSON']['output']>;
  nodes: Array<User>;
  nodesCount: Scalars['Int']['output'];
  nodesFacets: Maybe<Array<NodesFacet>>;
  nodesFilter: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type UserWarnings = {
  unreadGlobalNotices: Array<GlobalNotice>;
  unreadWarnings: Array<ModerationWarning>;
};

export type UsersSearchFilter = {
  filter?: InputMaybe<Array<UsersSearchFilter>>;
  nameExact?: InputMaybe<Array<BaseFilterValueEqualsMatches>>;
  nameWildcard?: InputMaybe<Array<BaseFilterValue>>;
  op?: InputMaybe<FilterLogicalOperator>;
};

export type UsersSearchSort = {
  name?: InputMaybe<BaseSortValue>;
  relevance?: InputMaybe<BaseSortValue>;
};

export type VerificationResult = {
  id: Scalars['ID']['output'];
  url: Scalars['String']['output'];
};

export type Video = Node & {
  allowComments: Maybe<Scalars['Boolean']['output']>;
  allowRating: Maybe<Scalars['Boolean']['output']>;
  category: VideoCategory;
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  game: Game;
  id: Scalars['ID']['output'];
  link: Scalars['String']['output'];
  mediaStatus: MediaStatus;
  owner: User;
  rating: Scalars['Int']['output'];
  siteUrl: Scalars['String']['output'];
  thumbnailUrl: Scalars['String']['output'];
  title: Maybe<Scalars['String']['output']>;
  viewerBlocked: Scalars['Boolean']['output'];
  views: Scalars['Int']['output'];
};

export type VideoCategory = {
  date: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
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

export type VirusTotalChunkScan = {
  chunkIndex: Scalars['Int']['output'];
  virusTotalPositives: Maybe<Scalars['Int']['output']>;
  virusTotalUrl: Maybe<Scalars['String']['output']>;
};

export type WalletList = {
  filteredCount: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type WriteFullPageNotificationToUserMutationPayload = {
  success: Maybe<Scalars['Boolean']['output']>;
};
