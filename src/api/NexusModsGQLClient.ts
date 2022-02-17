import { gql, GraphQLClient, ClientError } from 'graphql-request';
import { verify } from 'jsonwebtoken';
import { IModInfo, IModFiles, IUpdateEntry, IChangelogs, IGameInfo } from '@nexusmods/nexus-api';
import { NexusUser } from '../types/users';
import { logMessage } from './util';

const domain = 'https://api.nexusmods.com/v2/graphql';
const graphOptions = {};

type NexusModsAuthTypes = 'JWT' | 'APIKEY';

class NexusModsGQLClient {
    public GQLClient : GraphQLClient|undefined;
    private NexusModsUser: NexusUser|undefined;
    private headers: any;
    private authType: NexusModsAuthTypes = 'JWT';
    
    constructor(user: NexusUser) {
        this.GQLClient = new GraphQLClient(domain, graphOptions);
        this.GQLClient.setHeaders(this.headers);
        this.NexusModsUser = user;
        this.authType = user.jwt ? 'JWT' : 'APIKEY';
        this.headers = this.authType === 'JWT'  
        ? { apikey: user.apikey }
        : {  };
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

    public async me(): Promise<NexusUser|undefined> {
        await this.verifyToken();
        return this.NexusModsUser;
    }

    public async allGames(): Promise<IGameInfo[]> {
        // Static file: https://data.nexusmods.com/file/nexus-data/games.json
        return [];
    }

    public async gameInfo(identifier: string | number): Promise<IGameInfo|undefined> {
        return undefined;
    }

    public async updatedMods(gameDomain: string, period: string): Promise<IUpdateEntry[]> {
        return [];
    }

    public async modInfo(): Promise<IModInfo|undefined> {
        return undefined;
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

    /**
     * FindUser     */
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