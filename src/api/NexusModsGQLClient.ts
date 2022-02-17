import { gql, GraphQLClient, ClientError } from 'graphql-request';
import requestPromise from 'request-promise-native'; //For making API requests
import { verify } from 'jsonwebtoken';
import { IModInfo, IModFiles, IUpdateEntry, IChangelogs, IGameInfo } from '@nexusmods/nexus-api';
import { NexusUser } from '../types/users';
import { logMessage } from './util';
import { games, updatedMods as modUpdates, updatedMods } from './nexus-discord';

const domain = 'https://api.nexusmods.com/v2/graphql';
const staticGamesList = 'https://data.nexusmods.com/file/nexus-data/games.json';
const graphOptions = {};

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
            return incUnapproved;

        }
        catch(err) {
            return [];
        }
    }

    public async gameInfo(identifier: string | number): Promise<IGameInfo|undefined> {
        return undefined;
    }

    public async updatedMods(gameDomain: string, period: UpdatedModsPeriod = '1d'): Promise<IUpdateEntry[]> {
        // Not currently possible via GraphQL
        return updatedMods(this.NexusModsUser, gameDomain, period);
    }

    public async modInfo(ids: { gameDomain: string, modId: number }|{ gameDomain: string, modId: number }[]): Promise<IModInfo[]> {
        // GraphQL is missing the updated times from the v1 API. 
        if (!Array.isArray(ids)) ids = [ids];
        const query = gql
        `query Mods($ids: [CompositeDomainWithIdInput!]!) {
            legacyModsByDomain(ids: $ids) {
              nodes {
                uid
                modId
                name
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

        logMessage('Vars', ids);

        try {
            const res = await this.GQLClient.request(query, { ids });
            return res.legacyModsByDomain?.nodes || [];
        }
        catch(err) {
            logMessage('Mod Lookup Error!', err);
            throw new Error('Could not find some or all of the mods.')
        }
    }

    public async modFiles(): Promise<IModFiles> {
        return { file_updates: [], files: [] };
    }

    public async modChangelogs(): Promise<IChangelogs> {
        return {};
    }

    public async myCollections(): Promise<any> {
        const query = gql`
        query MyCollections($count: Int, $offset: Int) {
            myCollections(
              count: $count, 
              offset: $offset,
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
            logMessage('GQL Response', response);
            return response?.user ?? response?.userByName;
        }
        catch(err) {
            logMessage(`Could not resolve user: ${nameOrId}`, (err as ClientError).response|| err, true);
            throw new Error(`Could not resolve user: ${nameOrId}`);
        }
    }
}

export { NexusModsGQLClient };