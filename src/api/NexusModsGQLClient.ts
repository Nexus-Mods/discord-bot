import { gql, GraphQLClient, ClientError } from 'graphql-request';
import { verify } from 'jsonwebtoken';
import { getAccessToken } from '../server/NexusModsOAuth';
import { IModFiles, IUpdateEntry, IChangelogs, IGameInfo } from '@nexusmods/nexus-api';
import { NexusUser } from '../types/users';
import * as GQLTypes from '../types/GQLTypes';
import { logMessage } from './util';
import { games, modChangelogs, modFiles as files, updatedMods } from './nexus-discord';
import { updateUser } from './users';

const domain = 'https://api.nexusmods.com/v2/graphql';
const staticGamesList = 'https://data.nexusmods.com/file/nexus-data/games.json';
const oauthTokenPath = 'https://users.nexusmods.com/oauth/token';
const graphOptions = {};
let cache: { [id: string]: { expiry: number, data: any } } = {};
const cachePeriod: number = (5*60*1000); // 5mins

type NexusModsAuthTypes = 'OAUTH' | 'APIKEY';
type UpdatedModsPeriod = '1d' | '1w' | '1m';

interface OAuthTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
}

class NexusModsGQLClient {
    public GQLClient : GraphQLClient;
    private NexusModsUser: NexusUser;
    private headers: any;
    private authType: NexusModsAuthTypes = 'OAUTH';
    
    constructor(user: NexusUser) {
        this.GQLClient = new GraphQLClient(domain, graphOptions);
        this.NexusModsUser = user;
        this.authType = !!user.nexus_access ? 'OAUTH' : 'APIKEY';
        this.headers = this.authType === 'APIKEY'  
        ? { apikey: user.apikey }
        : { Authorization: `Bearer ${user.nexus_access}` };
        this.GQLClient.setHeaders(this.headers);
    }

    static async create(user: NexusUser): Promise<NexusModsGQLClient> {
        const client = new NexusModsGQLClient(user);
        // if (!user.jwt) throw new Error('Nexus Mods GQL Client requires a JWT token');
        try {
            if (client.authType === 'OAUTH') await client.getAccessToken(user);
            return client;
        }
        catch(err) {
            throw new Error('Could not validate auth token. Please try reauthorising your account.');
        }
    }

    private async getAccessToken(user: NexusUser): Promise<OAuthTokens> {
        // Check the OAuth Token is valid, so we can make requests.
        if (!!user.nexus_expires && !!user.nexus_refresh && !!user.nexus_access) {
            const tokens = {
                access_token: user.nexus_access,
                refresh_token: user.nexus_refresh,
                expires_at: user.nexus_expires
            }
            try {
                const newTokens = await getAccessToken(tokens);
                if (tokens.access_token !== newTokens.access_token) {
                    await this.updateTokens(newTokens);
                }
                return newTokens;
            }
            catch(err) {
                throw new Error('Unable to get OAuth tokens');
            }
        }
        else throw new Error('Token invalid or missing');
    }

    public async updateTokens(tokens: OAuthTokens): Promise<void> {

        const newTokens = {
            nexus_access: tokens.access_token,
            nexus_refresh: tokens.refresh_token,
            nexus_expires: tokens.expires_at
        };
        // Update the tokens saved in the database (and in the globals)
        this.NexusModsUser = { ...this.NexusModsUser, ...newTokens };
        // Save the new tokens to the database.
        await updateUser(this.NexusModsUser.d_id, newTokens);
    }

    public async me(): Promise<NexusUser|undefined> {
        await this.getAccessToken(this.NexusModsUser);
        return this.NexusModsUser;
    }

    public async allGames(): Promise<IGameInfo[]> {
        if (cache.allGames && cache.allGames.expiry > new Date().getTime()) {
            return cache.allGames.data;
        }
        // Static file: https://data.nexusmods.com/file/nexus-data/games.json
        // Unapproved games from the static file can't be filtered due to no approval date!
        
        // const raw = await requestPromise(staticGamesList)
        // const staticGames = JSON.parse(raw);
        
        // const query = gql
        // `query Games {
        //     games {
        //         id
        //         name
        //         domainName
        //     } 
        // }`

        try {
            // GQL version lacks a lot of the fields from the other methods
            // const res = await this.GQLClient?.request(query, {}, this.headers);
            // logMessage('Game query result', res.games?.length);
            // return res.games;

            const incUnapproved = await games(this.NexusModsUser, true);
            cache.allGames = { data: incUnapproved, expiry: new Date().getTime() + cachePeriod }
            return incUnapproved;

        }
        catch(err) {
            return [];
        }
    }

    public async gameInfo(identifier: string | number): Promise<IGameInfo|undefined> {
        const gamesList = await this.allGames();
        const game = gamesList.find(g => 
            g.id === identifier || 
            g.name.toLowerCase() === (identifier as string).toLowerCase() || 
            g.domain_name.toLowerCase() === (identifier as string).toLowerCase()
        );

        return game;
    }

    public async updatedMods(gameDomain: string, period: UpdatedModsPeriod = '1d'): Promise<IUpdateEntry[]> {
        // Not currently possible via GraphQL
        return updatedMods(this.NexusModsUser, gameDomain, period);
    }

    public async modInfo(rawIds: { gameDomain: string, modId: number }|{ gameDomain: string, modId: number }[]): Promise<Partial<GQLTypes.Mod>[]> {
        // The API has a page size limit of 50 (default 20) so we need to break our request into pages.
        const ids: { gameDomain: string, modId: number }[] = (!Array.isArray(rawIds)) ? [rawIds] : rawIds;

        if (!ids.length) return [];

        const pages: { gameDomain: string, modId: number }[][] = [];
        let length = 0
        while (length < ids.length - 1) {
            pages.push(ids.slice(length, 50));
            length += 50;
        }
        // logMessage('Processing mods in page batches', { total: pages.length, sizes: pages.map(p => p.length) });

        let results: Partial<GQLTypes.Mod>[] = [];

        for (const page of pages) {
            try {
                const pageData = await this.modInfoPage(page);
                if (pageData.length != page.length) logMessage('Did not get back the same number of mods as sent', { sent: page.length, got: pageData.length }, true);
                results = [...results, ...pageData];
            }
            catch(err) {
                logMessage('Error fetching mod data', {err, auth: this.authType, headers: this.headers}, true);
            }
        }

        return results;
    }

    public async modInfoPage(ids: { gameDomain: string, modId: number }[], offset: Number = 0, count: Number = 50): Promise<Partial<GQLTypes.Mod>[]> {
        // GraphQL is missing the updated times from the v1 API. 
        if (!ids.length) return [];
        const query = gql
        `query Mods($ids: [CompositeDomainWithIdInput!]!, $count: Int!, $offset: Int!) {
            legacyModsByDomain(ids: $ids, count: $count, offset: $offset) {
              nodes {
                uid
                modId
                name
                createdAt
                updatedAt
                summary
                status
                author
                uploader {
                  name
                  avatar
                  memberId
                }
                pictureUrl
                modCategory {
                  name
                }
                adult
                version
                game {
                  domainName
                  name
                }
              }
            }
        }`

        try {
            const res = await this.GQLClient.request(query, { ids, count, offset });
            return res.legacyModsByDomain?.nodes || [];
        }
        catch(err) {
            if (err as ClientError) {
                const error: ClientError = (err as ClientError);
                // console.log('ClientError', error);
                if (error.message.includes('Cannot return null for non-nullable field Mod.modCategory')) {
                    const gameIds = new Set(ids.map(i => i.gameDomain));
                    const consolidatedIds = [...gameIds].map(game => {
                        const gameMods = ids.filter(m => m.gameDomain === game).map(mod => mod.modId);
                        return `${game}: ${gameMods.join(', ')}`;
                    });
                    throw new Error('One or more mods are missing the category attribute.'+consolidatedIds.join('\n'));
                }
                else throw new Error('GraphQLError '+error);
            }
            logMessage('Unkown Mod Lookup Error!', err);
            throw new Error('Could not find some or all of the mods.');
        }
    }

    public async modFiles(domain: string, modId: number): Promise<IModFiles> {
        // Not currently possible via GraphQL
        return files(this.NexusModsUser, domain, modId);
    }

    public async modChangelogs(domain: string, modId: number): Promise<IChangelogs> {
        // Not currently possible via GraphQL
        return modChangelogs(this.NexusModsUser, domain, modId);
    }

    public async isCurator(): Promise<boolean> {
        const query = gql`
        query isCurator(
            $facets: CollectionsFacet,
            $filter: CollectionsFilter
          ) {
            myCollections(
              facets: $facets,
              filter: $filter,
              viewAdultContent: true,
            ) {
              nodesCount
            }
          }
        `;
        const variables = {
            facets: {
                adultContent: [ 'true', 'false' ],
                collectionStatus: [ 'listed' ]
            },
            filter: {
                op: 'AND',
                "hasPublishedRevision": [
                    {
                        value: 'true'
                    }
                ]
            }
        };

        try {
            const res = await this.GQLClient.request(query, variables, this.headers);
            return res.data?.myCollections;
        }
        catch(err) {
            throw err;
        }
    }

    public async myCollections(): Promise<any> {
        if (this.authType === 'APIKEY') throw new Error('Cannot retrieve collections with an API key. JWT only.');
        const query = gql`
        query MyCollections {
            myCollections(
              viewAdultContent: true,
              viewUnderModeration: true,
              viewUnlisted: true
            ) {
              nodesCount
              nodes {
                id
                slug
                name
                category {
                  name
                }
                adultContent
                endorsements
                totalDownloads
                draftRevisionNumber
                latestPublishedRevision {
                  fileSize
                  modCount
                }
                game {
                  id
                  domainName
                }
                user {
                  memberId
                  avatar
                  name
                }
                tileImage {
                  url
                  altText
                }
              }
            }
          }
        `
        const variables = {};

        try {
            const res = await this.GQLClient.request(query, variables, this.headers);
            return res.data?.myCollections;
        }
        catch(err) {
            throw err;
        }
    }

    public async collectionSearch(filters: GQLTypes.CollectionsFilter, sort: GQLTypes.CollectionsSortBy, adultContent?: boolean): Promise<GQLTypes.CollectionPage> {
        const query = gql`
        query searchCollections($filters: CollectionsUserFilter, $adultContent: Boolean, $count: Int, $sortBy: String) {
            collections(filter: $filters, viewAdultContent: $adultContent, count: $count, sortBy: $sortBy) {
                nodes {
                    slug
                    name
                    category {
                        name
                    }
                    game {
                        name
                        domainName
                    }
                    overallRating
                    totalDownloads
                    endorsements
                    user {
                        name
                    }
                }
                nodesFilter
                nodesCount
            }
        }
        `;

        const variables = {
            filters,
            sortBy: sort || 'endorsements_count',
            adultContent: adultContent || false,
            count: 5
        };

        const websiteLink = () => {
            const baseURL = 'https://next.nexusmods.com/search-results/collections?';
            const sorting = `sortBy=${variables.sortBy}`;
            const keyword = variables.filters.generalSearch ? `keyword=${variables.filters.generalSearch.value}` : '';
            const game = variables.filters.gameName ? `gameName=${encodeURI(variables.filters.gameName.value)}` : '';
            const adult = `adultContent=${variables.filters.adultContent?.value === true ? 1 : 0 || 0}`;
            const params = [keyword, adult, game, sorting].filter(p => p != '').join('&');
            return `${baseURL}${params}`;
        }

        try {
            const res: { collections: GQLTypes.CollectionPage } = await this.GQLClient.request(query, variables, this.headers);
            const collections = res.collections;
            collections.nextURL = websiteLink();
            return collections;
        }
        catch(err) {
            throw err;
        }
    }

    public async collection(slug: string, gameDomain: string, adult: boolean): Promise<Partial<GQLTypes.Collection>> {

        const query = gql`
        query getCollectionData($slug: String, $adult: Boolean, $domain: String) {
            collection(slug: $slug, viewAdultContent: $adult, domainName: $domain) {
                adultContent
                category {
                    name
                }
                endorsements
                game {
                    name
                    domainName
                }
                slug
                name
                overallRating
                overallRatingCount
                summary
                tileImage {
                    thumbnailUrl(size: small)
                }
                totalDownloads
                user {
                    name
                    memberId
                    avatar
                }
                updatedAt
                latestPublishedRevision {
                    modCount
                    revisionNumber
                }
            }
        }
        `
    const variables = {
        slug,
        adult,
        domain: gameDomain
    }

    try {
        const result: { collection: Partial<GQLTypes.Collection> } = await this.GQLClient.request(query, variables, this.headers);
        return result.collection;
        
    }
    catch(err) {
        logMessage(`Could not resolve collection: ${gameDomain}/${slug}`, (err as ClientError).response|| err, true);
        throw new Error(`Could not resolve collection: ${gameDomain}/${slug}`);
    }

    }

    public async findUser(nameOrId: string|number): Promise<any> {
        let query = '';
        let variables = {};
        if (typeof(nameOrId) === 'number') {
            query = gql
            `query UserById($id: Int!) {
                user(id: $id) {
                    name
                    memberId
                    avatar
                    recognizedAuthor
                }
            }`
            
            variables = { id: nameOrId };
        }
        else if (typeof(nameOrId) === 'string') {
            query = gql
            `query UserByName($username: String!) {
                userByName(name: $username) {
                    name
                    memberId
                    avatar
                    recognizedAuthor
                }
            }`

            variables = { username: nameOrId };
        }

        try {
            const response = await this.GQLClient?.request(query, variables, this.headers);
            // logMessage('GQL Response', response);
            return response?.user ?? response?.userByName;
        }
        catch(err) {
            logMessage(`Could not resolve user: ${nameOrId}`, (err as ClientError).response|| err, true);
            throw new Error(`Could not resolve user: ${nameOrId} - [${(err as ClientError).response?.status}] - ${(err as ClientError).response.errors?.toString()}`);
        }
    }
}

export { NexusModsGQLClient };