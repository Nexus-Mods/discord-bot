import * as NexusModsOAuth from '../server/NexusModsOAuth';
import * as DiscordOAuth from '../server/DiscordOAuth';
import { IUpdateEntry, IValidateKeyResponse } from '@nexusmods/nexus-api';
import { NexusLinkedMod, NexusUser } from '../types/users';
import { logMessage } from './util';
import { updateUser } from './users';
import { Client, EmbedBuilder, User } from 'discord.js';
import { other, v1, v2 } from './queries/all';
import * as GQLTypes from '../types/GQLTypes';
import { getModsbyUser, createMod, deleteMod, userProfileEmbed } from './bot-db';

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
    private NexusModsAuthType: NexusModsAuthTypes = 'OAUTH';
    private NexusModsAPIKey?: string = undefined;
    private NexusModsOAuthTokens?: OAuthTokens;
    private DiscordOAuthTokens?: OAuthTokens;
    public readonly NexusModsId: Readonly<number>;
    public NexusModsUsername: string;
    public NexusModsAvatar: string | undefined;
    public NexusModsRoles: Set<NexusMembershipRoles> = new Set();
    public readonly DiscordId: Readonly<string>;
    public LastUpdated: Date;

    constructor(user: NexusUser) {
        this.NexusModsId = user.id;
        this.DiscordId = user.d_id;
        this.NexusModsUsername = user.name;
        this.NexusModsAvatar = user.avatar_url;
        this.LastUpdated = user.lastupdate!;
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

    public ProfileEmbed = async (client: Client): Promise<EmbedBuilder> => userProfileEmbed(this, client);

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
        Refresh: () => this.refreshUserData(),
        Name: (): string => this.NexusModsUsername,
        // User: async () => undefined,
        Avatar: (): string | undefined => this.NexusModsAvatar,
        IsPremium: (): boolean => this.NexusModsRoles.has('premium'),
        IsSupporter: (): boolean => this.NexusModsRoles.has('supporter'),
        IsAuthor: (): boolean => this.NexusModsRoles.has('modauthor'),
        LinkedMods: () => getModsbyUser(this.NexusModsId),
        AddLinkedMod: (mod: NexusLinkedMod) => createMod(mod),
        DeleteLinkedMod: (mod: NexusLinkedMod) => deleteMod(mod),
        API: {
            v1: {
                Validate: async () => v1.validate(this.headers()),
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
                Game: async () => { throw new Error('Not Implemented') }, // TBC
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
                ModDownloads: async (gameId: number, modId?: number) => other.ModDownloads(gameId, modId),
            }     
        }
    }

    private async refreshUserData(): Promise<void> {
        if (this.NexusModsAPIKey && this.NexusModsAuthType === 'APIKEY') {
            try {
                const data = await this.NexusMods.API.v1.Validate();
                await this.updateUserDataFromAPIKey(data);
                
            }
            catch(err) {
                (err as Error).message = `Failed to refresh user data - ${(err as Error).message}`
                throw err;
            }
        }
        else if (this.NexusModsOAuthTokens) {
            try {
                const data = await NexusModsOAuth.getUserData(this.NexusModsOAuthTokens)
                await this.updateUserDataFromOAuth(data);
            }
            catch(err) {
                (err as Error).message = `Failed to refresh user data - ${(err as Error).message}`
                throw err;
            }
        }

        // Update Discord Metadata
        try {
            if (this.DiscordOAuthTokens) {
                const meta: Record<string, ('0' | '1')> = { 
                    member: '1',
                    premium: this.NexusModsRoles.has('premium') ? '1' :'0', 
                    supporter: (!this.NexusModsRoles.has('premium') && this.NexusModsRoles.has('supporter')) ? '1' : '0', 
                    modauthor: this.NexusModsRoles.has('modauthor') ? '1' : '0'
                };

                await DiscordOAuth.pushMetadata(
                this.DiscordId, 
                this.NexusModsUsername, 
                this.DiscordOAuthTokens, 
                meta
                );
            }

        }
        catch(err) {
            logMessage('Failed to update Discord role metadata', err, true);
        }
    }

    private async updateUserDataFromAPIKey(validatedKey: IValidateKeyResponse) {
        const { name, is_premium, is_supporter } = validatedKey;
        let newData: Partial<NexusUser> = {};
        // Update saved username
        if (name != this.NexusModsUsername) {
            newData.name = name;
            this.NexusModsUsername = name;
        }
        // Update saved Premium status
        if (is_premium && !this.NexusModsRoles.has('premium')) {
            newData.premium = is_premium;
            this.NexusModsRoles.add('premium');
        }
        else if (!is_premium && this.NexusModsRoles.has('premium')) {
            newData.premium = is_premium;
            this.NexusModsRoles.delete('premium');
        }
        // Update saved supporter status
        if ((!is_premium && is_supporter) && !this.NexusModsRoles.has('supporter')) {
            newData.supporter = is_supporter;
            this.NexusModsRoles.add('supporter');
        }
        try {
            const modAuthor = await this.NexusMods.API.v2.IsModAuthor(this.NexusModsId);
            if (modAuthor && !this.NexusModsRoles.has('modauthor')) {
                newData.modauthor = modAuthor;
                this.NexusModsRoles.add('modauthor');
            }
            else if (!modAuthor && !this.NexusModsRoles.has('modauthor')) {
                newData.modauthor = modAuthor;
                this.NexusModsRoles.delete('modauthor');
            }

        }
        catch(err) {
            logMessage('Could not check for mod author status', err);
        }

        try {
            if (Object.keys(newData).length) {
                await updateUser(this.DiscordId, newData);
                this.LastUpdated = new Date();
            };
        }
        catch(err) {
            throw new Error('Failed to save user data to database.');
        }
    }

    private async updateUserDataFromOAuth(userData: NexusUserData) {
        const { name, avatar, membership_roles } = userData;
        let newData: Partial<NexusUser> = {};
        if (name != this.NexusModsUsername) {
            this.NexusModsUsername = name;
            newData.name = name;
        }

        if (avatar != this.NexusModsAvatar) {
            this.NexusModsAvatar = avatar;
            newData.avatar_url = avatar;
        }

        if (membership_roles.includes('supporter') && !this.NexusModsRoles.has('supporter')) {
            this.NexusModsRoles.add('supporter');
            newData.supporter = true;
        }

        if (membership_roles.includes('premium') && !this.NexusModsRoles.has('premium')) {
            this.NexusModsRoles.add('premium');
            this.NexusModsRoles.delete('supporter');
            newData.premium = true;
            newData.supporter = false;
        }
        else if (!membership_roles.includes('premium') && this.NexusModsRoles.has('premium')) {
            this.NexusModsRoles.delete('premium');
            newData.premium = false;
        }

        try {
            const modAuthor = await this.NexusMods.API.v2.IsModAuthor(this.NexusModsId);
            if (modAuthor && !this.NexusModsRoles.has('modauthor')) {
                newData.modauthor = modAuthor;
                this.NexusModsRoles.add('modauthor');
            }
            else if (!modAuthor && !this.NexusModsRoles.has('modauthor')) {
                newData.modauthor = modAuthor;
                this.NexusModsRoles.delete('modauthor');
            }

        }
        catch(err) {
            logMessage('Could not check for mod author status', err);
        }


        try {
            if (Object.keys(newData).length) {
                await updateUser(this.DiscordId, newData);
                this.LastUpdated = new Date();
            };
        }
        catch(err) {
            throw new Error('Failed to save user data to database.');
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
            await this.NexusMods.API.v1.Validate();
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