import { gql, GraphQLClient, ClientError } from 'graphql-request';
import * as NexusModsOAuth from '../server/NexusModsOAuth';
import { IValidateKeyResponse } from '@nexusmods/nexus-api';
import { NexusUser } from '../types/users';
import * as GQLTypes from '../types/GQLTypes';
import { logMessage } from './util';
import { games, IValidateResponse, modChangelogs, modFiles as files, updatedMods, validate } from './nexus-discord';
import { updateUser } from './users';
import { Client, User } from 'discord.js';

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



export class DiscordBotUser {
    private GQLClient : GraphQLClient = new GraphQLClient(API_V2);
    private NexusModsAuthType: NexusModsAuthTypes = 'OAUTH';
    private NexusModsAPIKey?: string = undefined;
    private NexusModsOAuthTokens?: OAuthTokens;
    private DiscordOAuthTokens?: OAuthTokens;
    public readonly NexusModsId: Readonly<number>;
    public NexusModsUsername: string;
    public NexusModsAvatar: string | undefined;
    private NexusModsRoles: NexusMembershipRoles[] = [];
    public readonly DiscordId: Readonly<string>;

    constructor(user: NexusUser) {
        this.NexusModsId = user.id;
        this.DiscordId = user.d_id;
        this.NexusModsUsername = user.name;
        this.NexusModsAvatar = user.avatar_url;
        const NexusRoles: NexusMembershipRoles[]= ['member'];
        if (user.premium) NexusRoles.push('premium');
        if (user.supporter) NexusRoles.push('supporter');
        if (user.modauthor) NexusRoles.push('modauthor');
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

    private UpdateUserData(data: Partial<NexusUser>) {
        if (data.name) this.NexusModsUsername = data.name;
        if (data.avatar_url) this.NexusModsAvatar = data.avatar_url;
        const NexusRoles: NexusMembershipRoles[]= ['member'];
        if (data.premium) NexusRoles.push('premium');
        if (data.supporter) NexusRoles.push('supporter');
        if (data.modauthor) NexusRoles.push('modauthor');
        this.NexusModsRoles = NexusRoles;

        // Pull out tokens if this is an OAUTH session.
        if (!!data.nexus_access && !!data.nexus_refresh && data.nexus_expires) {
            const NexusOAuth: OAuthTokens = {
                access_token: data.nexus_access,
                refresh_token: data.nexus_refresh,
                expires_at: (typeof data.nexus_expires === 'string') ? parseInt(data.nexus_expires) : data.nexus_expires,
            };
            const DiscordOAuth = {
                access_token: data.discord_access || '',
                refresh_token: data.discord_refresh || '',
                expires_at: (typeof data.discord_expires === 'string') ? parseInt(data.discord_expires!) : (data.discord_expires || 0),
            }
            this.NexusModsAuthType = 'OAUTH';
            this.NexusModsOAuthTokens = NexusOAuth;
            this.DiscordOAuthTokens = DiscordOAuth;
        }
        // Pull out API key if this is an APIKey session.
        else if (!!data.apikey) {
            this.NexusModsAPIKey = data.apikey;
            this.NexusModsAuthType = 'APIKEY';
        }
        else throw new Error('Nexus Mods User does not have any auth options set');
        
    }

    public NexusMods = {
        Auth: async () => this.authoriseNexusMods(),
        ID: (): number => this.NexusModsId,
        Name: (): string => this.NexusModsUsername,
        User: async () => undefined,
        Avatar: (): string | undefined => this.NexusModsAvatar,
        IsPremium: (): boolean => this.NexusModsRoles.includes('premium'),
        IsSupporter: (): boolean => this.NexusModsRoles.includes('supporter'),
        IsAuthor: (): boolean => this.NexusModsRoles.includes('modauthor'),
        API: {
            v1: {
                QuickSearch: async () => [],
                UpdatedMods: async () => [],
                Mod: async () => [],
                ModFiles: async () => [],
                ModChangelogs: async () => [],
            },
            v2: {
                IsModAuthor: async (): Promise<boolean> => false,
                Games: async () => [],
                Mod: async () => [],
                Mods: async () => [],
                MyCollections: async () => [],
                Collections: async () => [],
                Collection: async () => [],
                FindUser: async () => [] 
            }         
        }
    }

    private async authoriseNexusMods(): Promise<void> {
        if (this.NexusModsOAuthTokens) {
            const userData = await NexusModsOAuth.getUserData(this.NexusModsOAuthTokens);
            if (userData.name && userData.name !== this.NexusModsUsername)
            return;
        }
        else if (this.NexusModsAPIKey) {
            const validatedKey = await validate(this.NexusModsAPIKey);
            return;
        }
        else throw new Error('No API key or OAuth tokens');
    }

    public Discord = {
        Auth: async () => true,
        ID: (): string => this.DiscordId,
        User: async (client: Client): Promise<User> => client.users.fetch(this.DiscordId)
    }
}