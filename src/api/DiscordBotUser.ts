import * as NexusModsOAuth from '../server/NexusModsOAuth';
import * as DiscordOAuth from '../server/DiscordOAuth';
import { NexusUser } from '../types/users';
import { baseheader, Logger } from './util';
import { updateUser } from './users';
import { Client, EmbedBuilder, User } from 'discord.js';
import { other, v2 } from './queries/all';
import * as GQLTypes from '../types/GQLTypes';
import { userProfileEmbed } from './bot-db';
import { IModsFilter, IModsSort } from './queries/v2';

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

type NexusModsAuthTypes = 'OAUTH';
type NexusMembershipRoles = 'member' | 'supporter' | 'premium' | 'lifetimepremium' | 'modauthor';

interface IRequestHeadersOAuth extends Record<string, string> {
    'Application-Name': string;
    'Application-Version': string;
    'Authorization': string;
}

export const DummyNexusModsUser: Readonly<NexusUser> = Object.freeze({
    d_id: 'none',
    id: -1,
    name: 'DummyUser',
    supporter: false,
    premium: false
});


export class DiscordBotUser {
    private NexusModsAuthType: NexusModsAuthTypes = 'OAUTH';
    private NexusModsOAuthTokens?: OAuthTokens;
    private DiscordOAuthTokens?: OAuthTokens;
    public readonly NexusModsId: Readonly<number>;
    public NexusModsUsername: string;
    public NexusModsAvatar: string | undefined;
    public NexusModsRoles: Set<NexusMembershipRoles> = new Set();
    public readonly DiscordId: Readonly<string>;
    public LastUpdated: Date;
    private logger: Logger;

    constructor(user: NexusUser, logger: Logger) {
        this.logger = logger;
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
        if (user.id === -1) return;
        else if (!!user.nexus_access && !!user.nexus_refresh && user.nexus_expires) {
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
        else throw new Error('Nexus Mods User does not have any auth options set: '+ JSON.stringify({ name: user.name, token: user.nexus_access }));
    }

    public ProfileEmbed = async (client: Client): Promise<EmbedBuilder> => userProfileEmbed(this, client);

    private headers = (noAuth?: boolean): IRequestHeadersOAuth => {

        let header = { ...baseheader};

        if (noAuth === true || this.NexusModsId === -1) return header as IRequestHeadersOAuth;

        if (!this.NexusModsOAuthTokens || !this.NexusModsOAuthTokens?.access_token) 
            throw new Error('Invalid auth - headers could not be generated.');
        
        header['Authorization'] = `Bearer ${this.NexusModsOAuthTokens.access_token}`;
    
        return header as IRequestHeadersOAuth;
        
    };

    public NexusMods = {
        Auth: async () => this.authoriseNexusMods(),
        Token: () => this.NexusModsOAuthTokens,
        ID: (): number => this.NexusModsId,
        Refresh: () => this.refreshUserData(),
        Name: (): string => this.NexusModsUsername,
        // User: async () => undefined,
        Avatar: (): string | undefined => this.NexusModsAvatar,
        IsPremium: (): boolean => this.NexusModsRoles.has('premium'),
        IsSupporter: (): boolean => this.NexusModsRoles.has('supporter'),
        IsAuthor: (): boolean => this.NexusModsRoles.has('modauthor'),
        Revoke: () => this.NexusModsAuthType === 'OAUTH' && !!this.NexusModsOAuthTokens ? NexusModsOAuth.revoke(this.NexusModsOAuthTokens) : null,
        API: {
            v2: {
                IsModAuthor: async (id: number): Promise<boolean> => v2.isModAuthor(this.headers(), this.logger, id),
                Game: async (id: number) => v2.game(this.headers(), this.logger, id),
                Mod: async (gameDomain: string, modId: number ) => v2.modsById(this.headers(), this.logger, [{ gameDomain, modId }]),
                Mods: async (filter: IModsFilter, sort?: IModsSort ) => v2.mods(this.headers(), this.logger, filter, sort),
                UpdatedMods: 
                    async (since: Date | number | string, includeAdult: boolean, gameId?: number | number[], sort?: IModsSort ) => 
                        v2.updatedMods(this.headers(), this.logger, since, includeAdult, gameId, sort),
                UpdatedModsAutoMod: 
                    async (since: Date | number | string, includeAdult: boolean, gameId?: number | number[], sort?: IModsSort ) => 
                        v2.updatedModsAutoMod(this.headers(), this.logger, since, includeAdult, gameId, sort),
                ModsByModId: 
                    async (mods: { gameDomain: string, modId: number } | { gameDomain: string, modId: number }[]) => 
                        v2.modsById(this.headers(), this.logger, mods),
                ModsByUid: async (uids: string[]) => v2.modsByUid(this.headers(), this.logger, uids),
                MyCollections: async () => v2.myCollections(this.headers(), this.logger),
                Collections: 
                    async (filters: GQLTypes.ICollectionsFilter, sort?: GQLTypes.CollectionsSort, adultContent?: boolean) => 
                        v2.collections(this.headers(), this.logger, filters, sort, adultContent),
                Collection: async (slug: string, domain: string, adult: boolean) => v2.collection(this.headers(), this.logger, slug, domain, adult),
                CollectionsByUser: async (userId: number) => v2.collections(this.headers(), this.logger, { userId: { value: userId.toString(), op: 'EQUALS' }, adultContent: { value: true, op: 'EQUALS' } }),
                CollectionDownloadTotals: async (userId: number) => v2.collectionsDownloadTotals(this.headers(), this.logger, userId),
                FindUser: async (query: string | number) => v2.findUser(this.headers(), this.logger, query),
                LatestMods: async (since: Date, gameIds?: number | number[], sort?: IModsSort) => v2.latestMods(this.headers(true), this.logger, since, gameIds, sort),
                LastestModsAutoMod: async (since: Date, gameIds?: number | number[], sort?: IModsSort) => v2.latestModsAutoMod(this.headers(true), this.logger, since, gameIds, sort),
                News: async (gameId?: number) => v2.news(this.headers(), this.logger, gameId),
                ModFiles: async (gameId: number, modId: number) => v2.modFiles(this.headers(), this.logger, gameId, modId),
                Users: async (name: string) => v2.users(this.headers(), this.logger, name),
                CollectionRevisions: async (domain: string, slug: string) => v2.collectionRevisions(this.headers(), this.logger, slug, domain)            },
            Other: {
                // Games pulled from the static Games.json file.
                Games: async () => other.Games(this.headers()),
                // Mod stats from the static CSV files.
                ModDownloads: async (gameId: number, modId?: number) => other.ModDownloads(gameId, modId),
                SiteStats: async () => other.SiteStats(this.headers()),
                WebsiteStatus: async (full: boolean = false) => other.WebsiteStatus(this.headers(), this.logger, full),
            }     
        }
    }

    private async refreshUserData(): Promise<(keyof NexusUser)[]> {
        let updated : (keyof NexusUser)[] = [];
        if (this.NexusModsOAuthTokens) {
            try {
                const data = await NexusModsOAuth.getUserData(this.NexusModsOAuthTokens, this.logger)
                updated = await this.updateUserDataFromOAuth(data);
            }
            catch(err) {
                (err as Error).message = `Failed to refresh user data - ${(err as Error).message}`
                throw err;
            }
        }

        // Get total collection downloads
        let collectiondownloads = 0;
        try {
            const savedMeta = await this.Discord.GetRemoteMetaData();
            const newTotals = await this.NexusMods.API.v2.CollectionDownloadTotals(this.NexusModsId);
            collectiondownloads = newTotals.uniqueDownloads ?? savedMeta?.metadata.collectiondownloads;
        }
        catch(err) {
            this.logger.warn('Error getting Collection download totals', { name: this.NexusModsUsername, err });
        }

        // Update Discord Metadata
        try {
            if (this.DiscordOAuthTokens) {
                const meta: DiscordOAuth.BotMetaData = { 
                    premium: this.NexusModsRoles.has('premium') ? '1' :'0', 
                    supporter: (!this.NexusModsRoles.has('premium') && this.NexusModsRoles.has('supporter')) ? '1' : '0', 
                    modauthor: this.NexusModsRoles.has('modauthor') ? '1' : '0',
                    collectiondownloads
                };

                await DiscordOAuth.pushMetadata(
                this.logger,
                this.DiscordId, 
                this.NexusModsUsername, 
                this.DiscordOAuthTokens, 
                meta
                );
            }

        }
        catch(err) {
            this.logger.warn('Failed to update Discord role metadata', err, true);
        }

        return updated;
    }

    private async updateUserDataFromOAuth(userData: NexusUserData): Promise<(keyof NexusUser)[]> {
        const updatedFields: (keyof NexusUser)[] = [];
        const { name, avatar, membership_roles } = userData;
        let newData: Partial<NexusUser> = {};
        if (name != this.NexusModsUsername) {
            this.NexusModsUsername = name;
            newData.name = name;
            updatedFields.push('name');
        }

        if (avatar != this.NexusModsAvatar) {
            this.NexusModsAvatar = avatar;
            newData.avatar_url = avatar;
            updatedFields.push('avatar_url');
        }

        if (membership_roles.includes('supporter') && !this.NexusModsRoles.has('supporter')) {
            this.NexusModsRoles.add('supporter');
            newData.supporter = true;
            updatedFields.push('supporter');
        }

        if (membership_roles.includes('premium') && !this.NexusModsRoles.has('premium')) {
            this.NexusModsRoles.add('premium');
            this.NexusModsRoles.delete('supporter');
            newData.premium = true;
            newData.supporter = false;
            updatedFields.push('premium');
        }
        else if (!membership_roles.includes('premium') && this.NexusModsRoles.has('premium')) {
            this.NexusModsRoles.delete('premium');
            newData.premium = false;
            updatedFields.push('premium');
        }

        try {
            const modAuthor = await this.NexusMods.API.v2.IsModAuthor(this.NexusModsId);
            if (modAuthor && !this.NexusModsRoles.has('modauthor')) {
                newData.modauthor = modAuthor;
                this.NexusModsRoles.add('modauthor');
                updatedFields.push('modauthor');
            }
            else if (!modAuthor && !this.NexusModsRoles.has('modauthor')) {
                newData.modauthor = modAuthor;
                this.NexusModsRoles.delete('modauthor');
                updatedFields.push('modauthor');
            }

        }
        catch(err) {
            this.logger.warn('Could not check for mod author status', err);
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

        return updatedFields;
    }

    private async authoriseNexusMods(): Promise<void> {
        if (this.NexusModsOAuthTokens) {
            // logMessage('Authorising tokens', { name: this.NexusModsUsername });
            const { access_token, refresh_token, expires_at } = await NexusModsOAuth.getAccessToken(this.NexusModsOAuthTokens);
            this.NexusModsOAuthTokens = { access_token, refresh_token, expires_at };
            return this.saveTokens(this.NexusModsOAuthTokens);
        }
        else throw new Error('No OAuth tokens');
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
        Auth: async () => {
            if (this.DiscordOAuthTokens) return DiscordOAuth.getAccessToken(this.DiscordId, this.DiscordOAuthTokens, this.logger)
            else throw new Error('Discord not authorised');
        },
        ID: (): string => this.DiscordId,
        User: async (client: Client): Promise<User> => client.users.fetch(this.DiscordId),
        Revoke: () => !!this.DiscordOAuthTokens ? DiscordOAuth.revoke(this.DiscordOAuthTokens) : null,
        BuildMetaData: () => this.getDiscordMetaData(),
        GetRemoteMetaData: async () => this.DiscordOAuthTokens ? DiscordOAuth.getMetadata(this.DiscordId, this.DiscordOAuthTokens, this.logger) : undefined,
        PushMetaData: 
        async (meta: { modauthor?: '1' | '0', premium?: '1' | '0', supporter?: '1' | '0', collectiondownloads?: number, moddownloads?: number }) => 
            this.DiscordOAuthTokens 
            ? DiscordOAuth.pushMetadata(this.logger, this.DiscordId, this.NexusModsUsername, this.DiscordOAuthTokens, meta) 
            : new Error('Not Authorised')
    }

    private async getDiscordMetaData (): Promise<DiscordOAuth.BotMetaData> {
        let oldData;
        
        try {
            oldData = await this.Discord.GetRemoteMetaData();
        }
        catch(err) {
            if ((err as Error).message.includes('Too Many Requests')) this.logger.warn('Could not fetch saved Discord metadata', { user: this.NexusModsUsername, err: '429 - Rate limited' })
            else this.logger.warn('Could not fetch saved Discord metadata', { user: this.NexusModsUsername, err });
        }

        // Get collection downloads
        let collectiondownloads = oldData?.metadata?.collectiondownloads ?? 0;
        let moddownloads = oldData?.metadata?.moddownloads ?? 0;
        try {
            const collectionTotals = await this.NexusMods.API.v2.CollectionDownloadTotals(this.NexusModsId);
            collectiondownloads = collectionTotals.uniqueDownloads;
            const modTotals = await this.NexusMods.API.v2.FindUser(this.NexusModsId);
            moddownloads = modTotals?.uniqueModDownloads ?? 0;
            this.logger.info('Download totals', { name: this.NexusModsUsername, collectiondownloads, moddownloads })
        }
        catch(err) {
            this.logger.warn('Failed to get collection/mod downloads to build Discord metadata', { user: this.NexusModsUsername, err });
        }

        return {
            modauthor: this.NexusModsRoles.has('modauthor')? '1' : '0',
            premium: this.NexusModsRoles.has('premium') ? '1' : '0',
            supporter: (this.NexusModsRoles.has('supporter') && !this.NexusModsRoles.has('premium')) ? '1' : '0',
            collectiondownloads,
            moddownloads
        };
    } 
}