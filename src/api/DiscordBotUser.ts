import { GraphQLClient } from 'graphql-request';
import * as NexusModsOAuth from '../server/NexusModsOAuth';
import { IUpdateEntry } from '@nexusmods/nexus-api';
import { NexusUser } from '../types/users';
import { logMessage } from './util';
import { modFiles as files, validate } from './nexus-discord';
import { updateUser } from './users';
import { Client, User } from 'discord.js';
import { other, v1, v2 } from './queries/queries';
import * as GQLTypes from '../types/GQLTypes';

const API_V2: string = 'https://api.nexusmods.com/v2/graphql';

interface OAuthTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
}

interface NexusUserData {
    sub: string;
    name: string;
    email: string;
    avatar: string;
    group_id: number;
    membership_roles: NexusMembershipRoles[];
}

type NexusModsAuthTypes = 'OAUTH' | 'APIKEY';
type NexusMembershipRoles = 'member' | 'supporter' | 'premium' | 'lifetimepremium' | 'modauthor';

interface IRequestHeadersOAuth extends Record<string, string> {
    'Application-Name': string;
    'Application-Version': string;
    'Authorization': string;
}

interface IRequestHeadersAPIkey extends Record<string, string> {
    'Application-Name': string;
    'Application-Version': string;
    'apikey': string;
}


export class DiscordBotUser {
    private GQLClient : GraphQLClient = new GraphQLClient(API_V2);
    private NexusModsAuthType: NexusModsAuthTypes = 'OAUTH';
    private NexusModsAPIKey?: string = undefined;
    private NexusModsOAuthTokens?: OAuthTokens;
    private DiscordOAuthTokens?: OAuthTokens;
    public readonly NexusModsId: Readonly<number>;
    public NexusModsUsername: string;
    public NexusModsAvatar: string | undefined;
    private NexusModsRoles: Set<NexusMembershipRoles> = new Set();
    public readonly DiscordId: Readonly<string>;

    constructor(user: NexusUser) {
        this.NexusModsId = user.id;
        this.DiscordId = user.d_id;
        this.NexusModsUsername = user.name;
        this.NexusModsAvatar = user.avatar_url;
        const NexusRoles: Set<NexusMembershipRoles> = new Set<NexusMembershipRoles>().add('member');
        if (user.premium) NexusRoles.add('premium');
        if (user.supporter) NexusRoles.add('supporter');
        if (user.modauthor) NexusRoles.add('modauthor');
        this.NexusModsRoles = NexusRoles;

        // Pull out tokens if this is an OAUTH session.
        if (!!user.nexus_access && !!user.nexus_refresh && user.nexus_expires) {
            const NexusOAuth: OAuthTokens = {
                access_token: user.nexus_access,
                refresh_token: user.nexus_refresh,
                expires_at: (typeof user.nexus_expires === 'string') ? parseInt(user.nexus_expires) : user.nexus_expires,
            };
            const DiscordOAuth = {
                access_token: user.discord_access || '',
                refresh_token: user.discord_refresh || '',
                expires_at: (typeof user.discord_expires === 'string') ? parseInt(user.discord_expires!) : (user.discord_expires || 0),
            }
            this.NexusModsAuthType = 'OAUTH';
            this.NexusModsOAuthTokens = NexusOAuth;
            this.DiscordOAuthTokens = DiscordOAuth;
        }
        // Pull out API key if this is an APIKey session.
        else if (!!user.apikey) {
            this.NexusModsAPIKey = user.apikey;
            this.NexusModsAuthType = 'APIKEY';
        }
        else throw new Error('Nexus Mods User does not have any auth options set');
    }

    private headers = (): (IRequestHeadersOAuth | IRequestHeadersAPIkey) => {
        if (!this.NexusModsAPIKey && !this.NexusModsOAuthTokens) 
            throw new Error('Invalid auth - headers could not be generated.');
        
        let baseheader: Record<string, string> = {
            'Application-Name': 'Nexus Mods Discord Bot',
            'Application-Version': process.env.npm_package_version || '0.0.0',
        }
        
        if (!!this.NexusModsOAuthTokens?.access_token) baseheader['Authorization'] = `Bearer ${this.NexusModsOAuthTokens.access_token}`;
        else baseheader['apikey'] = this.NexusModsAPIKey!;
    
        return baseheader as IRequestHeadersAPIkey || baseheader as IRequestHeadersOAuth;
        
    };

    public NexusMods = {
        Auth: async () => this.authoriseNexusMods(),
        ID: (): number => this.NexusModsId,
        Name: (): string => this.NexusModsUsername,
        User: async () => undefined,
        Avatar: (): string | undefined => this.NexusModsAvatar,
        IsPremium: (): boolean => this.NexusModsRoles.has('premium'),
        IsSupporter: (): boolean => this.NexusModsRoles.has('supporter'),
        IsAuthor: (): boolean => this.NexusModsRoles.has('modauthor'),
        API: {
            v1: {
                Game: async (domain: string) => v1.game(this.headers(), domain),
                Games: async () => v1.games(this.headers()),
                ModQuickSearch: 
                    async (query: string, adult: boolean, gameId?: number) => 
                        v1.quicksearch(query, adult, gameId),
                UpdatedMods: 
                    async (domain: string, period?: string): Promise<IUpdateEntry[]> => 
                        v1.updatedMods(this.headers(), domain, period),
                Mod: 
                    async (domain: string, id: number) => 
                        v1.modInfo(this.headers(), domain, id),
                ModFiles: 
                    async (domain: string, id: number) => 
                        v1.modFiles(this.headers(), domain, id),
                ModChangelogs: 
                    async (domain: string, id: number) => 
                        v1.modChangelogs(this.headers(), domain, id),
            },
            v2: {
                IsModAuthor: async (id: number): Promise<boolean> => v2.isModAuthor(this.headers(), id),
                Games: async () => v2.games(this.headers()),
                Mod: async (mod: { gameDomain: string, modId: number }) => v2.mods(this.headers(), mod),
                Mods: async () => { throw new Error('Not Implemented') },
                ModsByModId: 
                    async (mods: { gameDomain: string, modId: number } | { gameDomain: string, modId: number }[]) => 
                        v2.mods(this.headers(), mods),
                MyCollections: async () => v2.myCollections(this.headers()),
                Collections: 
                    async (filters: GQLTypes.CollectionsFilter, sort: GQLTypes.CollectionsSortBy, adultContent?: boolean) => 
                        v2.collections(this.headers(), filters, sort, adultContent),
                Collection: async (slug: string, domain: string, adult: boolean) => v2.collection(this.headers(), slug, domain, adult),
                CollectionsByUser: async (userId: number) => v2.collectionsByUser(this.headers(), userId),
                FindUser: async (query: string | number) => v2.findUser(this.headers(), query)
            },
            Other: {
                // Games pulled from the static Games.json file.
                Games: async () => other.Games(this.headers()),
                // Mod stats from the static CSV files.
                ModDownloads: async (domain: string, modId?: number) => { throw new Error('Not Implemented') },
            }     
        }
    }

    private async authoriseNexusMods(): Promise<void> {
        if (this.NexusModsOAuthTokens) {
            const { access_token, refresh_token, expires_at } = await NexusModsOAuth.getAccessToken(this.NexusModsOAuthTokens);
            this.NexusModsOAuthTokens = { access_token, refresh_token, expires_at: expires_at as number };
            // const userData: NexusUserData = await NexusModsOAuth.getUserData(this.NexusModsOAuthTokens);
            // ToDo: Need to update the tokens in the class and DB after this!
            return this.saveTokens({ access_token, refresh_token, expires_at: expires_at as number });
        }
        else if (this.NexusModsAPIKey) {
            await validate(this.NexusModsAPIKey);
            return;
        }
        else throw new Error('No API key or OAuth tokens');
    }

    private async saveTokens(newTokens: OAuthTokens): Promise<any> {
        const { access_token, refresh_token, expires_at } = newTokens;
        const newData: Partial<NexusUser> = { 
            nexus_access: access_token, 
            nexus_expires: expires_at, 
            nexus_refresh: refresh_token 
        };

        return updateUser(this.DiscordId, newData);
    }

    public Discord = {
        Auth: async () => true,
        ID: (): string => this.DiscordId,
        User: async (client: Client): Promise<User> => client.users.fetch(this.DiscordId)
    }
}

// const db = new DiscordBotUser({ d_id: '', id: 234, name: '', supporter: false, premium: false });
// db.NexusMods.API.Other.Games()