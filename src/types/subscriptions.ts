
import { APIEmbed, EmbedBuilder, Guild, GuildMember, Snowflake, TextChannel, WebhookClient, ShardClientUtil, Client } from 'discord.js';
import { createSubscription, getSubscriptionsByChannel, updateSubscription } from '../api/subscriptions';
import { gameArt, Logger, nexusModsTrackingUrl } from '../api/util';
import { CollectionStatus, ICollection, ICollectionRevision, IMod, IModFile } from '../api/queries/v2';
import { getUserByNexusModsId } from '../api/users';
import { IUser } from '../api/queries/v2-finduser';
import { customEmojis } from './util';
import { ModStatus } from './GQLTypes';

export interface ISubscribedChannel {
    id: number;
    guild_id: Snowflake;
    channel_id: Snowflake;
    webhook_id: Snowflake;
    webhook_token: string;
    last_update: Date;
    created: Date;
}

export class SubscribedChannel implements ISubscribedChannel {
    id: number;
    guild_id: string;
    channel_id: string;
    webhook_id: string;
    webhook_token: string;
    last_update: Date;
    created: Date;

    public webHookClient: WebhookClient
    private subscribedItems: SubscribedItem<SubscribedItemType>[] = [];
    private logger: Logger;
    
    constructor(c: ISubscribedChannel, items: SubscribedItem<SubscribedItemType>[], logger: Logger) {
        this.logger = logger;
        this.id = c.id;
        this.guild_id = c.guild_id;
        this.channel_id = c.channel_id;
        this.webhook_id = c.webhook_id;
        this.webhook_token = c.webhook_token;
        this.last_update = c.last_update;
        this.created = c.created;
        this.subscribedItems = items;

        this.webHookClient = new WebhookClient({ id: this.webhook_id, token: this.webhook_token});
    }

    public shardId = (client: Client): number => ShardClientUtil.shardIdForGuildId(this.guild_id, client.shard?.count ?? 1);

    public static async create(c: ISubscribedChannel, logger: Logger, items: SubscribedItem<SubscribedItemType>[] = []): Promise<SubscribedChannel> {
        try {
            if (items.length === 0) items = await getSubscriptionsByChannel(c.guild_id, c.channel_id);
            return new SubscribedChannel(c, items, logger);

        }
        catch(err) {
            logger.error('Error creating subscribed channel class', err);
            throw new Error('Unable to create subscribed channel class');
        }
    }

    async getSubscribedItems(skipCache: boolean = false): Promise<SubscribedItem<SubscribedItemType>[]> {
        if (!this.subscribedItems.length || skipCache) {
            // fetch from database
            this.subscribedItems = await getSubscriptionsByChannel(this.guild_id, this.channel_id);
        }
        
        return this.subscribedItems;
    }

    async subscribe(data: Omit<SubscribedItem<SubscribedItemType>, 'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'>): Promise<SubscribedItem<SubscribedItemType>> {
        try {
            const newSub = await createSubscription(this.id, data);
            this.subscribedItems.push(newSub);
            return newSub;
        }
        catch(err) {
            this.logger.error('Could not create subscription', err);
            throw err;
        }

    }

    async updateSub(id: number, data: Omit<SubscribedItem<SubscribedItemType>, 'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'>): Promise<SubscribedItem<SubscribedItemType>> {
        try {
            const updatedSub = await updateSubscription(id, this.id, data);
            const index = this.subscribedItems.findIndex(i => i.id === id);
            if (index !== -1) this.subscribedItems[index] = updatedSub;
            else this.subscribedItems.push(updatedSub);
            return updatedSub;
        }
        catch(err) {
            this.logger.error('Could not update subscription', err);
            throw err;
        }
    }


}

export enum SubscribedItemType {
    Game = 'game',
    User = 'user',
    Mod = 'mod',
    Collection = 'collection'
}

export interface ISubscribedItem<T extends SubscribedItemType>{
    id: number;
    parent: number;
    type: T;
    title: string;
    entityid: string | number;
    owner: Snowflake;
    last_update: Date;
    created: Date;
    crosspost: boolean;
    compact: boolean;
    message: string | null;
    error_count: number;
    config?: ISubscribedItemConfig<SubscribedItemType>;
}

type ISubscribedItemConfig<T> =
    T extends SubscribedItemType.Game ? ISubscribedItemConfigGame :
    T extends SubscribedItemType.User ? undefined :
    T extends SubscribedItemType.Mod ? ISubscribedItemConfigMod :
    T extends SubscribedItemType.Collection ? ISubscribedItemConfigCollection 
    : never;

interface ISubscribedItemConfigGame {
    // Show NSFW content
    nsfw?: boolean;
    // Show SFW content
    sfw?: boolean;
    // Show new content
    show_new?: boolean;
    // Show updated content
    show_updates?: boolean;
}

interface ISubscribedItemConfigUser {
}

interface ISubscribedItemConfigMod {
    // The last status of the entity.
    last_status: ModStatus;
}

interface ISubscribedItemConfigCollection {
    // The last status of the entity.
    last_status: CollectionStatus;

}

interface ISubscribedGameItem extends ISubscribedItem<SubscribedItemType.Game> {
    entityid: string;
    type: SubscribedItemType.Game;
    // show_new: boolean;
    // show_updates:boolean;
}

interface ISubscribedModItem extends ISubscribedItem<SubscribedItemType.Mod> {
    entityId: string;
    type: SubscribedItemType.Mod;
    // last_status: ModStatus;
}

interface ISubscribedCollectionItem extends ISubscribedItem<SubscribedItemType.Collection> {
    entityId: string;
    type: SubscribedItemType.Collection;
    collectionIds: {
        gameDomain: string;
        slug: string;
    }
    // last_status: CollectionStatus;
}

interface ISubscribedUserItem extends ISubscribedItem<SubscribedItemType.User> {
    entityId: number;
    type: SubscribedItemType.User;
}

export type ISubscribedItemUnionType = 
    | ISubscribedGameItem
    | ISubscribedModItem
    | ISubscribedCollectionItem
    | ISubscribedUserItem;

export class SubscribedItem<T extends SubscribedItemType> {
    // Database identiifier
    id : number;
    // Parent channel DB identifier
    parent: number;
    // What kind of item are we subbed to?
    type: T;
    // Displayable title without re-fetching
    title: string;
    // Entity ID (mod ID, collection slug, user ID, game domain)
    entityid: string | number;
    // Discord ID of the owner.
    owner: string;
    // Last update to this subscribed item
    last_update: Date;
    // When was it created
    created: Date;
    // Should updates crosspost?
    crosspost: boolean;
    // Display compact mode
    compact: boolean;
    // Message to post with updates
    message: string | null;
    // Error counter, when it gets too high we abandon this feed.
    error_count: number;
    // Collection IDs
    collectionIds?: { gameDomain: string, slug: string };
    // config object
    config: ISubscribedItemConfig<T>;

    constructor(item: Extract<ISubscribedItemUnionType, { type: T }>) {
        this.id = item.id;
        this.type = item.type;
        this.title = item.title;
        this.entityid = item.entityid
        this.owner = item.owner;
        this.last_update = item.last_update as Date ? item.last_update : new Date(item.last_update);
        this.created = item.created as Date ? item.created : new Date(item.created);
        this.crosspost = item.crosspost;
        this.compact = item.compact;
        this.message = item.message;
        this.error_count = item.error_count;
        this.parent = item.parent;
        this.config = item.config as ISubscribedItemConfig<T>;
        if (item.type === SubscribedItemType.Collection) {
            const [gameDomain, slug] = (this.entityid as string).split(':');
            this.collectionIds = { gameDomain, slug };
        } else if (item.type === SubscribedItemType.User) {
            this.entityid = parseInt(item.entityid as string);
        }
    }

    public showAdult(channel: TextChannel): boolean {
        if (this.type === SubscribedItemType.Game && this.config && 'nsfw' in this.config) {
            return this.config.nsfw ?? channel.nsfw;
        }
        return channel.nsfw;
    }
}

interface ISubscriptionCache {
    games: {
        new: { [domain: string] : IMod[] };
        updated: { [domain: string] : IMod[] }; 
    }
    mods: {
        [modUid: string]: IMod;
    }
    modFiles: {
        [modUid: string]: any[];
    }
    collections: {
        [slug: string]: ICollection;
    }
    users: {
        [id: number]: any;
    }
}

export class SubscriptionCache implements ISubscriptionCache {
    games: { 
        new: { [domain: string] : IMod[] };
        updated: { [domain: string] : IModWithFiles[] };  
    };
    mods: { [modUid: string]: IMod; };
    modFiles: { [modUid: string]: IModFile[]; };
    collections: { [slug: string]: ICollection; };
    users: { [id: string]: any; };

    constructor() {
        this.games = {new: {}, updated: {}};
        this.mods = {};
        this.modFiles = {};
        this.collections = {};
        this.users = {};
    }

    public add(type: 'games', content: IMod[], key: string, updated?: boolean) : void;
    public add(type: 'mods', content: IMod[], key: string) : void;
    public add(type: 'modFiles', content: any[], key: string) : void;
    public add(type: 'collections', content: ICollection[], key: string) : void;
    public add(type: 'users', content: any, key: string) : void;
    public add(type: keyof ISubscriptionCache, content: any, key: string, updated:boolean = false) {
        if (type == 'games') {
            if (updated) this[type].updated[key] = content;
            else this[type].new[key] = content;
        }
        else this[type][key] = content;
    }

    public getCachedMod(uuid: string, domain: string): IMod | undefined {
        return this.mods[uuid] 
        || this.games.new[domain].find(m => m.uid === uuid)
        || this.games.updated[domain].find(m => m.uid === uuid);
    }

    public getCachedModsForGame(domain: string, updated:boolean): IMod[] | undefined {
        return updated ? this.games.updated[domain] : this.games.new[domain];
    }

    public getCachedModFiles(uuid: string): IModFile[] | undefined {
        return this.modFiles[uuid];
    }

    public getCachedCollection(slug: string): ICollection | undefined {
        return this.collections[slug];
    }

    public getCachedUser(id: number) {
        return this.users[id.toString()];
    }

}

export interface IPostableSubscriptionUpdate<T extends SubscribedItemType> {
    type: SubscribedItemType;
    date: Date;
    embed: APIEmbed;
    entity: EntityType<T>;
    subId: any;
    message?: string | null;
    crosspost: boolean;
}

export type IModWithFiles = IMod & { files?: IModFile[] };

type EntityType<T extends SubscribedItemType> = 
    T extends 'game' ? IMod :
    T extends 'mod' ? IModWithFiles:
    T extends 'collection' ? ICollection & { revisions?: ICollectionRevision[] } :
    T extends 'user' ? any : null;

type UserEntityType<T extends UserEmbedType | undefined> =
    T extends 'new-mod' | 'updated-mod' ? IUser & { mod: T extends 'new-mod' ? IMod : IModWithFiles } :
    T extends 'new-collection' | 'updated-collection' ? IUser & { collection: ICollection } :
    T extends 'new-image' | 'new-video' ? any : null;

export enum UserEmbedType {
    NewMod = 'new-mod',
    UpdatedMod = 'updated-mod',
    NewCollection = 'new-collection',
    UpdatedCollection = 'updated-collection',
    NewImage = 'new-image',
    NewVideo = 'new-video'
}

export async function subscribedItemEmbed<T extends SubscribedItemType>(logger: Logger, entity: EntityType<T>, sub: SubscribedItem<T>, guild: Guild, updated: boolean = false, userEmbedType: UserEmbedType | null = null): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder();
    const compact: boolean = sub.compact;
    switch (sub.type) {
        case SubscribedItemType.Game: {
            const mod = entity as IModWithFiles;
            let lastestFile = updated ? mod.files?.[0] : undefined;
            const gameThumb: string = gameArt(mod.game.id);
            // Try and find a Discord user for the mod uploader
            const linkedUser = await getUserByNexusModsId(mod.uploader.memberId);
            const guildMember: GuildMember | undefined = linkedUser ? await guild.members.fetch(linkedUser?.DiscordId).catch(() => undefined) : undefined;

            embed.setTitle(mod.name)
            .setURL(nexusModsTrackingUrl(`https://www.nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'subscribedGame'))
            .setDescription(mod.summary.length ? mod.summary : '_No summary_')
            .setImage(compact ? null :  mod.pictureUrl || null)
            .setThumbnail(compact ? mod.pictureUrl : gameThumb)
            // Updated or otherwise
            if (updated) {
                embed.setColor(0x57a5cc)
                .setAuthor({ name: `Mod Updated (${mod.game.name})`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
                .setTimestamp(new Date(lastestFile ? lastestFile.date * 1000 : mod.updatedAt))
                if (lastestFile && lastestFile.changelogText.length) {
                    const changelog = trimModChangelog(lastestFile.changelogText, 1000, logger);
                    if (changelog?.length) embed.addFields({ name: `Changelog (v${lastestFile.version})`, value: trimModChangelog(lastestFile.changelogText, 1000, logger)});
                }
            }
            else {
                embed.setColor(0xda8e35)
                .setAuthor({ name: `New Mod Upload (${mod.game.name})`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
                .setTimestamp(new Date(mod.createdAt))
            }
            embed.setFooter({ text: `${mod.game.name}  •  ${mod.modCategory.name ?? 'Invalid Category'}  • v${mod.version} `, iconURL: compact ? gameThumb : undefined })
            .addFields(
                {
                    name: 'Author',
                    value: mod.author,
                    inline: true
                },
                {
                    name: 'Uploader',
                    value: `[${mod.uploader.name}](${nexusModsTrackingUrl(`https://nexusmods.com/users/${mod.uploader.memberId}`, 'subscribedGame')})`,
                    inline: true
                }
            )
            if (guildMember) embed.addFields({ name: 'Discord', value: guildMember.toString(), inline: true })

        }
        break;
        case SubscribedItemType.Mod: {
            const modWithFiles: IModWithFiles = entity as IModWithFiles;
            const file: IModFile = modWithFiles.files![0];
            let changelog = file.changelogText.length ? trimModChangelog(file.changelogText, compact ? 500: 1000, logger) : undefined;
            embed.setColor('#2dd4bf')
            .setAuthor({ 
                name: modWithFiles.uploader.name, 
                url: nexusModsTrackingUrl(`https://nexusmods.com/users/${modWithFiles.uploader.memberId}`, 'subscribedMod'),
                iconURL: modWithFiles.uploader.avatar
            })
            .setTitle(`${file.name} v${file.version} is now available!`)
            .setDescription(`A new version can be downloaded from [${modWithFiles.name}](${nexusModsTrackingUrl(`https://nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}`, 'subscribedMod')}) on Nexus Mods.\n${changelog ? `## Changelog\n${changelog}` : ''}`)
            // .setURL(nexusModsTrackingUrl(`https://nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}`, 'subscribedMod', { 'tab': 'files' }))
            .setThumbnail(modWithFiles.pictureUrl)
            .setTimestamp(new Date(file.date * 1000))
            .setFooter({ text: `${modWithFiles.game.name} • v${modWithFiles.version}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
            .addFields(
                file.manager === 0 
                ?   {
                        name: 'Mod Manager',
                        value: `[Download ↗](https://discordbot.nexusmods.com/nxm?type=mod&domain=${modWithFiles.game.domainName}&mod_id=${modWithFiles.modId}&file_id=${file.fileId})\n-# Requires Premium 💎`,
                        inline: true
                    } 
                :   {
                        name: 'Direct Download',
                        value: `[Download ↗](${nexusModsTrackingUrl(`https://www.nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}`, 'subscribedMod', { 'tab': 'files', 'file_id': file.fileId.toString() })})`,
                        inline: true
                    },
                {
                    name: 'Nexus Mods',
                    value: `[View Mod Page ↗](${nexusModsTrackingUrl(`https://nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}/`, 'subscribedMod')})`,
                    inline: true
                }
            )
        }
        break;
        case SubscribedItemType.Collection: {
            const collection: EntityType<SubscribedItemType.Collection> = entity;
            const revision: ICollectionRevision = collection.revisions![0];
            embed.setColor('#2dd4bf')
            .setAuthor({
                name: collection.user.name,
                url: nexusModsTrackingUrl(`https://nexusmods.com/users/${collection.user.memberId}`, 'subscribedCollection'),
                iconURL: collection.user.avatar
            })
            .setTitle(`${collection.name} Revision ${revision.revisionNumber} is now available!`)
            .setDescription(
                `## Changelog\n`+
                (revision.collectionChangelog.description.length ? trimCollectionChangelog(revision.collectionChangelog.description, compact ? 500 : undefined) : '__Not provided__')
            )
            // .setURL(nexusModsTrackingUrl(`https://nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`, 'subscribedCollection'))
            .setThumbnail(collection.tileImage.url)
            .setTimestamp(new Date(revision.updatedAt))
            .setFooter({ text: `${collection.game.name}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
            .addFields(
                [
                    {
                        name: 'Mod Manager',
                        value: `[Download ↗](https://discordbot.nexusmods.com/nxm?type=collection&domain=${collection.game.domainName}&slug=${collection.slug}&rev=${revision.revisionNumber})`,
                        inline: true
                    },
                    {
                        name: 'Nexus Mods',
                        value: `[Revision ${revision.revisionNumber} ↗](${nexusModsTrackingUrl(`https://nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}/revisions/${revision.revisionNumber}`, 'subscribedCollection')})`,
                        inline: true
                    }
                ]
            )
        }
        break;
        case SubscribedItemType.User: {
            const userUrl = nexusModsTrackingUrl(`https://nexusmods.com/users/${entity.memberId}`, 'subscribedUser');
            switch (userEmbedType) {
                case UserEmbedType.NewMod: {
                    const userWithMod = entity as UserEntityType<UserEmbedType.NewMod>;
                    const mod = userWithMod.mod;
                    embed.setColor('#2dd4bf')
                    .setAuthor(
                        {
                            name: `${userWithMod.name} uploaded a new mod!`,
                            url: userUrl,
                            iconURL: userWithMod.avatar
                        }
                    )
                    .setTitle(`<:mod:${customEmojis.mod}> ${mod.name.slice(0, 225)}`)
                    .setDescription(`${mod.summary ?? '_No Summary_'}\n[View Mod ↗](${nexusModsTrackingUrl(`https://nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'subscribedUser')})`)
                    .setImage(compact ? null : mod.pictureUrl)
                    .setThumbnail(compact ? mod.pictureUrl : null)
                    .setFooter({ text: `${mod.game.name} • v${mod.version}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png'})
                    .setTimestamp(new Date(mod.createdAt))
                }
                break;
                case UserEmbedType.UpdatedMod: {
                    const userWithMod = entity as UserEntityType<UserEmbedType.UpdatedMod>;
                    const mod = userWithMod.mod;
                    const file = mod.files?.length ? mod.files[0] : undefined;
                    const changelog: string | undefined = file?.changelogText.length ? trimModChangelog(file.changelogText, compact ? 500: 1000, logger) : undefined;
                    embed.setColor('#2dd4bf')
                    .setAuthor(
                        {
                            name: `${userWithMod.name} updated a mod!`,
                            url: userUrl,
                            iconURL: userWithMod.avatar
                        }
                    )
                    .setTitle(`<:mod:${customEmojis.mod}> ${mod.name.slice(0, 225)}`)
                    .setDescription(`${mod.summary ?? '_No Summary_'}\n[View Mod ↗](${nexusModsTrackingUrl(`https://nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'subscribedUser')})`)
                    .setImage(compact ? null : mod.pictureUrl)
                    .setThumbnail(compact ? mod.pictureUrl : null)
                    .setFooter({ text: `${mod.game.name} • v${mod.version}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png'})
                    .setTimestamp(file?.date ? new Date(file.date * 1000) : new Date(mod.updatedAt))
                    if (changelog && changelog.length) embed.addFields({ name: 'Changelog', value: changelog });
                }
                break;
                case UserEmbedType.NewCollection: {
                    const userWithCollection = entity as UserEntityType<UserEmbedType.NewCollection>;
                    const collection = userWithCollection.collection;
                    embed.setColor('#2dd4bf')
                    .setAuthor(
                        {
                            name: `${userWithCollection.name} shared a new collection!`,
                            url: userUrl,
                            iconURL: userWithCollection.avatar
                        }
                    )
                    .setTitle(`<:collection:${customEmojis.collection}>  ${collection.name}`)
                    .setDescription(`${collection.summary ?? '_No Summary_'}\n[View Collection ↗](${nexusModsTrackingUrl(`https://nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`, 'subscribedUser')})`)
                    .setImage(compact ? null : collection.tileImage.url)
                    .setThumbnail(compact ? collection.tileImage.url : null)
                    .setFooter({ text: `${collection.game.name} • Revision ${collection.latestPublishedRevision.revisionNumber}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png'})
                    .setTimestamp(new Date(collection.latestPublishedRevision.updatedAt))
                }
                break;
                case UserEmbedType.UpdatedCollection: {
                    const userWithCollection = entity as UserEntityType<UserEmbedType.UpdatedCollection>;
                    const collection = userWithCollection.collection;
                    embed.setColor('#2dd4bf')
                    .setAuthor(
                        {
                            name: `${userWithCollection.name} updated a collection!`,
                            url: userUrl,
                            iconURL: userWithCollection.avatar
                        }
                    )
                    .setTitle(`<:collection:${customEmojis.collection}>  ${collection.name}`)
                    .setDescription(`${collection.summary ?? '_No Summary_'}\n[View Collection ↗](${nexusModsTrackingUrl(`https://nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`, 'subscribedUser')})`)
                    .setImage(compact ? null : collection.tileImage.url)
                    .setThumbnail(compact ? collection.tileImage.url : null)
                    .setFooter({ text: `${collection.game.name} • Revision ${collection.latestPublishedRevision.revisionNumber}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png'})
                    .setTimestamp(new Date(collection.latestPublishedRevision.updatedAt))
                    .addFields({ name: 'Changelog ↗', value: `[View](${nexusModsTrackingUrl(`https://www.nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}/changelog`, 'subscribedUser')})` })
                }
                break;
                case UserEmbedType.NewImage: {
                    embed.setDescription('Media updates have not been implemented yet.');
                }
                break;
                case UserEmbedType.NewVideo: {
                    embed.setDescription('Media updates have not been implemented yet.');
                }
                break;
                default: embed.setDescription(`Unknown user embed type: ${userEmbedType}`);
            }
        }
        break;
        default: embed.setDescription(`Unknown SubscribedItemType when building Embed: ${sub.type}`);

    }

    return embed;
}

export function unavailableUpdate<T extends SubscribedItemType>(entity: EntityType<T>, type: SubscribedItemType, sub: SubscribedItem<T>, newStatus: ModStatus | CollectionStatus): IPostableSubscriptionUpdate<T> {
    const embed = new EmbedBuilder();
    let date = new Date();
    if (type === SubscribedItemType.Mod) {
        newStatus = newStatus as ModStatus;
        const mod = entity as EntityType<SubscribedItemType.Mod>;
        date = typeof mod.updatedAt === 'string' ? new Date(mod.updatedAt) : mod.updatedAt;
        switch (newStatus) {
            case 'hidden': {
                embed.setTitle(`${mod.name} has been hidden`)
                .setDescription(
                    `The mod page has been temporarily hidden from viewing by the mod author, a team member, or a moderator.\n`+
                    `[More Info](${nexusModsTrackingUrl(`https://nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'subscribedMod')})`
                )
                .setColor('DarkGold')
                .setThumbnail(null)
            }
            break;
            case 'under_moderation': {
                embed.setTitle(`${mod.name} has been placed under moderator review`)
                .setDescription(
                    'The mod page is unavaialble while it is reviewed by a moderator. \n'+
                    'This mod may become available again, but it can take some time depending on the nature of the issue and how long the author takes to respond.'
                )
                .setColor('DarkRed')
                .setThumbnail(null)
            }
            break;
            case 'removed': {
                embed.setTitle(`${mod.name} has been deleted`)
                .setDescription(`The mod page has been deleted by the mod author or a team member. \nNo further updates will be posted.`)
                .setColor('Red')
                .setThumbnail(null)
            }
            break;
            case 'wastebinned': {
                embed.setTitle(`${mod.name} has been permanently removed`)
                .setDescription(`The mod page has been permanently deleted by a moderator for breaching the Nexus Mods Terms of Service. \nNo further updates will be posted.`)
                .setColor('Red')
                .setThumbnail(null)
            }
            break;
        }

    }
    else if (type === SubscribedItemType.Collection) {
        newStatus = newStatus as CollectionStatus;
        const collection = entity as EntityType<SubscribedItemType.Collection>;
        date = typeof collection.latestPublishedRevision.updatedAt === 'string' ? new Date(collection.latestPublishedRevision.updatedAt) : collection.latestPublishedRevision.updatedAt;
        switch (newStatus) {
            case 'under_moderation': {
                embed.setTitle(`${collection.name} has been placed under moderator review`)
                .setDescription(
                    'The collection page is unavaialble while it is reviewed by a moderator. \n'+
                    'This mod may become available again, but it can take some time depending on the nature of the issue and how long the author takes to respond.'
                )
                .setColor('DarkRed')
                .setThumbnail(null)
            }
            break;
            case 'discarded' : {
                embed.setTitle(`${collection.name} has been permanently removed`)
                .setDescription(`The collection page has been permanently deleted by a moderator for breaching the Nexus Mods Terms of Service. \nNo further updates will be posted.`)
                .setColor('Red')
                .setThumbnail(null)
            }
            break;
        }

    }

    return {
        type,
        date,
        embed: embed.data,
        entity,
        subId: sub.id,
        message: sub.message,
        crosspost: sub.crosspost ?? false,
    }
}

export function unavailableUserUpdate(entity: IUser, sub: SubscribedItem<SubscribedItemType.User>): IPostableSubscriptionUpdate<SubscribedItemType.User> {
    const embed = new EmbedBuilder()
    if (entity.deleted) {
        embed.setColor('DarkerGrey')
        .setTitle(`${sub.title} has deleted their account`)
        .setDescription(`You can no longer track updated for ${sub.title} as they have deleted their account.`);
    }
    else if (entity.banned) {
        embed.setColor('DarkRed')
        .setTitle(`${sub.title} has been banned`)
        .setDescription(`The user account ${sub.title} has been banned from Nexus Mods for breaching the community rules.\nMore details can be found in the [public bans forum](https://forums.nexusmods.com/forum/188-formal-warnings-bans-and-takedowns/).`)
    }

    return {
        entity,
        type: SubscribedItemType.User,
        date: new Date(),
        subId: sub.id,
        embed: embed.data,
        crosspost: sub.crosspost ?? false,
    }
}

// Cut to length and reformat any incompatible markdown
function trimCollectionChangelog(markdown: string, maxLength: number = 2000): string {
    // Remove images by regex (anything inside ![...](...) will be removed)
    let modifiedMarkdown = markdown.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '');

    // Convert all headers to h3 by replacing headers with less than 3 # symbols
    modifiedMarkdown = modifiedMarkdown.replace(/^#{1,2} (.*)/gm, '### $1');

    // Extract only the text inside <summary> tags within <details> sections
    modifiedMarkdown = modifiedMarkdown.replace(/<details><summary>(.*?)<\/summary>[\s\S]*?<\/details>/g, '$1 (View full changelog to expand)');

    // Replace these weird HTML encoded spaces
    modifiedMarkdown = modifiedMarkdown.replace('&#x20;', '');

    // break into lines, then reduce to the max length 
    const newLines = modifiedMarkdown.split('\n');
    let trimmedMarkdown = '';
    for (const line of newLines) {

        const temp = `${trimmedMarkdown}\n${line}`;
        if (temp.length >= maxLength) {
            trimmedMarkdown += '...'
            break;
        }
        else trimmedMarkdown = temp;
    }

    return trimmedMarkdown; 

}

function trimModChangelog(raw: string[], limit: number = 1000, logger: Logger): string {
    // THIS FEATURE IS BROKEN IN THE API, WE'LL CHECK IF IT'S STILL INVALID AND RETURN NULL IF IT IS.
    if (raw[0].startsWith('#<ModChangelog')) {
        logger.debug('Mod changelogs are still broken, returning a generic message.');
        return '_Changelog could not be rendered due to [an API bug](https://forums.nexusmods.com/topic/13512031-changelogs-on-the-modfiles-endpoint-are-not-showing-the-correct-data/). \n Please use the Logs tab on the mod page to view the changelog._';
    }
    let changelog = '';
    for (const line of raw) {
        const temp = changelog.length ? `${changelog}\n${line}` : line;
        if (temp.length >= limit) {
            changelog = changelog += '...'
            break;
        }
        else changelog = temp;
    }

    return changelog;
}