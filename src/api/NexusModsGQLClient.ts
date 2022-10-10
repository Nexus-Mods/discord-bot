import { gql, GraphQLClient, ClientError } from 'graphql-request';
// import requestPromise from 'request-promise-native'; //For making API requests
import { verify } from 'jsonwebtoken';
import { IModFiles, IUpdateEntry, IChangelogs, IGameInfo } from '@nexusmods/nexus-api';
import { NexusUser } from '../types/users';
import * as GQLTypes from '../types/GQLTypes';
import { logMessage } from './util';
import { games, modChangelogs, modFiles as files, updatedMods } from './nexus-discord';

const domain = 'https://api.nexusmods.com/v2/graphql';
const staticGamesList = 'https://data.nexusmods.com/file/nexus-data/games.json';
const graphOptions = {};
let cache: { [id: string]: { expiry: number, data: any } } = {};
const cachePeriod: number = (5*60*1000); // 5mins

type NexusModsAuthTypes = 'JWT' | 'APIKEY';
type UpdatedModsPeriod = '1d' | '1w' | '1m';

class NexusModsGQLClient {
    public GQLClient : GraphQLClient;
    private NexusModsUser: NexusUser;
    private headers: any;
    private authType: NexusModsAuthTypes = 'JWT';
    
    constructor(user: NexusUser) {
        this.GQLClient = new GraphQLClient(domain, graphOptions);
        this.NexusModsUser = user;
        this.authType = user.jwt ? 'JWT' : 'APIKEY';
        this.headers = this.authType === 'JWT'  
        ? { apikey: user.apikey }
        : {  };
        this.GQLClient.setHeaders(this.headers);
    }

    static async create(user: NexusUser): Promise<NexusModsGQLClient> {
        const client = new NexusModsGQLClient(user);
        // if (!user.jwt) throw new Error('Nexus Mods GQL Client requires a JWT token');
        try {
            await client.verifyToken();
            return client;
        }
        catch(err) {
            throw new Error('Could not validate auth token. Please try reauthorising your account.');
        }
    }

    private async verifyToken(): Promise<void> {
        // Check the JWT Token is valid, so we can make requests.
    }

    private async refreshToken(): Promise<void> {
        // If the token has expired, request a new one. 
    }

    public async me(): Promise<NexusUser|undefined> {
        await this.verifyToken();
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
        // GraphQL is missing the updated times from the v1 API. 
        let ids: { gameDomain: string, modId: number }[] = [];
        if (!Array.isArray(rawIds)) ids = [rawIds];
        else ids = rawIds
        const query = gql
        `query Mods($ids: [CompositeDomainWithIdInput!]!) {
            legacyModsByDomain(ids: $ids) {
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
            const res = await this.GQLClient.request(query, { ids });
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
            throw new Error(`Could not resolve user: ${nameOrId}`);
        }
    }
}

export { NexusModsGQLClient };