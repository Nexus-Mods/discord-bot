
import { EmbedBuilder, Guild, GuildMember, Snowflake, TextChannel, WebhookClient } from 'discord.js';
import { createSubscription, getSubscriptionsByChannel, updateSubscription } from '../api/subscriptions';
import { logMessage, nexusModsTrackingUrl } from '../api/util';
import { ICollection, ICollectionRevision, IMod, IModFile } from '../api/queries/v2';
import { getUserByNexusModsId } from '../api/users';

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
    private subscribedItems: SubscribedItem[] = [];
    
    constructor(c: ISubscribedChannel, items: SubscribedItem[]) {
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

    public static async create(c: ISubscribedChannel): Promise<SubscribedChannel> {
        try {
            const items = await getSubscriptionsByChannel(c.guild_id, c.channel_id);
            return new SubscribedChannel(c, items);

        }
        catch(err) {
            logMessage('Error creating subscribed channel class', err, true);
            throw new Error('Unable to create subscribed channel');
        }
    }

    async getSubscribedItems(skipCache: boolean = false): Promise<SubscribedItem[]> {
        if (!this.subscribedItems.length || skipCache) {
            // fetch from database
            this.subscribedItems = await getSubscriptionsByChannel(this.guild_id, this.channel_id);
        }
        
        return this.subscribedItems;
    }

    async subscribe(data: Omit<SubscribedItem, 'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'>): Promise<SubscribedItem> {
        try {
            const newSub = await createSubscription(this.id, data);
            return newSub;
        }
        catch(err) {
            logMessage('Could not create subscription', err, true);
            throw err;
        }

    }

    async updateSub(id: number, data: Omit<SubscribedItem, 'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'>): Promise<SubscribedItem> {
        try {
            const updatedSub = await updateSubscription(id, this.id, data);
            return updatedSub;
        }
        catch(err) {
            logMessage('Could not update subscription', err, true);
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

export interface ISubscribedItem {
    id: number;
    parent: number;
    title: string;
    entityid: any;
    owner: Snowflake;
    last_update: Date;
    created: Date;
    crosspost: boolean;
    compact: boolean;
    message: string | null;
    error_count: number;
    nsfw?: boolean;
    sfw?: boolean;
    collectionIds?: {
        domain: string;
        slug: string;
    } 
}

export interface ISubscribedGameItem extends ISubscribedItem {
    entityid: string;
    type: SubscribedItemType.Game;
    show_new: boolean;
    show_updates:boolean;
}

export interface ISubscribedModItem extends ISubscribedItem {
    entityId: number;
    type: SubscribedItemType.Mod;
}

export interface ISubscribedCollectionItem extends ISubscribedItem {
    entityId: string;
    type: SubscribedItemType.Collection;
    collectionIds: {
        domain: string;
        slug: string;
    }
}

export interface ISubscribedUserItem extends ISubscribedItem {
    entityId: number;
    type: SubscribedItemType.User;
}

export type ISubscribedItemUnionType = 
    | ISubscribedGameItem
    | ISubscribedModItem
    | ISubscribedCollectionItem
    | ISubscribedUserItem;

export class SubscribedItem {
    // Database identiifier
    id : number;
    // Parent channel DB identifier
    parent: number;
    // What kind of item are we subbed to?
    type: SubscribedItemType;
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
    // Show NSFEW content
    nsfw?: boolean;
    // Show SFW content
    sfw?: boolean;
    // Show new content (Mods only)
    show_new?: boolean;
    // Show updated content (Mods only)
    show_updates?: boolean;
    // Collection IDs
    collectionIds?: { domain: string, slug: string };

    constructor(item: ISubscribedItemUnionType) {
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
        this.nsfw = item.nsfw;
        this.sfw = item.sfw;
        if (item.type === SubscribedItemType.Game) {
            this.show_new = item.show_new;
            this.show_updates = item.show_updates; 
        }
        if (item.type === SubscribedItemType.Collection) {
            const [domain, slug] = (this.entityid as string).split(':');
            this.collectionIds = { domain, slug };
        }
    }

    public showAdult(channel: TextChannel): boolean {
        if ((this.type === SubscribedItemType.Game || this.type === SubscribedItemType.User) && this.nsfw !== undefined) return this.nsfw;
        else return channel.nsfw;
    }
}

export interface ISubscriptionCache {
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
    embed: EmbedBuilder;
    entity: EntityType<T>;
    message?: string | null;
}

export type IModWithFiles = IMod & { files?: IModFile[] };

type EntityType<T extends SubscribedItemType> = 
    T extends 'game' ? IMod :
    T extends 'mod' ? IModWithFiles:
    T extends 'collection' ? ICollection & { revisions: ICollectionRevision[] } :
    T extends 'user' ? any : null;

export async function subscribedItemEmbed<T extends SubscribedItemType>(entity: EntityType<T>, sub: SubscribedItem, guild: Guild, updated: boolean = false): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder();
    switch (sub.type) {
        case SubscribedItemType.Game: {
            const mod = entity as IModWithFiles;
            const compact: boolean = sub.compact;
            let lastestFile = updated ? mod.files?.[0] : undefined;
            const gameThumb: string = `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${mod.game.id}.jpg`;
            // Try and find a Discord user for the mod uploader
            const linkedUser = await getUserByNexusModsId(mod.uploader.memberId);
            const guildMember: GuildMember | undefined = linkedUser ? await guild.members.fetch(linkedUser?.DiscordId) : undefined;

            embed.setTitle(mod.name)
            .setURL(nexusModsTrackingUrl(`https://www.nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'subscribedGame'))
            .setDescription(mod.summary ?? '_No summary_')
            .setImage(compact ? null :  mod.pictureUrl || null)
            .setThumbnail(compact ? mod.pictureUrl : gameThumb)
            // Updated or otherwise
            if (updated) {
                embed.setColor(0x57a5cc)
                .setAuthor({ name: `Mod Updated (${mod.game.name})`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
                .setTimestamp(new Date(lastestFile ? lastestFile.date * 1000 : mod.updatedAt))
                if (lastestFile) {
                    let changelog = '';
                    // If the changelog is bigger than a field size, add an ellipse and exit
                    for (const t of lastestFile.changelogText) {
                        const temp = `${changelog}- ${t}\n`;
                        if (temp.length > 1020) {
                            changelog = `${changelog}...`;
                            break;
                        }
                        else changelog = temp;
                    }
                    if (changelog.length) embed.addFields({ name: `Changelog (v${lastestFile.version})`, value: changelog})
                }
            }
            else {
                embed.setColor(0xda8e35)
                .setAuthor({ name: `New Mod Upload (${mod.game.name})`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
                .setTimestamp(new Date(mod.createdAt))
            }
            embed.setFooter({ text: `${mod.game.name}  •  ${mod.modCategory.name}  • v${mod.version} `, iconURL: compact ? gameThumb : undefined })
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
            // logMessage(`Building embed for ${file.version} on ${modWithFiles.name}`)
            const compact: boolean = sub.compact;
            embed.setColor('Aqua')
            .setAuthor({ 
                name: modWithFiles.uploader.name, 
                url: nexusModsTrackingUrl(`https://nexusmods.com/users/${modWithFiles.uploader.memberId}`, 'subscribedMod'),
                iconURL: modWithFiles.uploader.avatar
            })
            .setTitle(`${file.name} v${file.version} is now available!`)
            .setDescription(`A new version can be downloaded from [${modWithFiles.name}](${nexusModsTrackingUrl(`https://nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}`, 'subscribedMod')}) on Nexus Mods.`)
            .setURL(nexusModsTrackingUrl(`https://nexusmods.com/${modWithFiles.game.domainName}/mods/${modWithFiles.modId}?tab=files`, 'subscribedMod'))
            .setThumbnail(modWithFiles.pictureUrl)
            .setTimestamp(new Date(file.date * 1000))
            .setFooter({ text: `${modWithFiles.game.name} • v${modWithFiles.version}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' });
            if (file.changelogText.length) {
                const changelogTrimLength = compact ? 250: 1020;
                const changelog = file.changelogText.reduce((prev, cur) => {
                    const current = `- ${cur}`;
                    const aggrigate = prev.length ? `${prev}\n${current}` : current;
                    if (aggrigate.length >= changelogTrimLength) return prev
                    else return prev = aggrigate;
                }, '')
                embed.addFields({ name: 'Changelog', value: changelog });
            };
        }
        break;
        case SubscribedItemType.Collection: {
            const collection: EntityType<SubscribedItemType.Collection> = entity;
            const revision: ICollectionRevision = collection.revisions[0];
            const compact: boolean = sub.compact;
            embed.setColor('Random')
            .setAuthor({
                name: collection.user.name,
                url: nexusModsTrackingUrl(`https://nexusmods.com/users/${collection.user.memberId}`, 'subscribedCollection'),
                iconURL: collection.user.avatar
            })
            .setTitle(`${collection.name} Revision ${revision.revisionNumber} is now available!`)
            .setDescription(
                `### Changelog\n`+
                (revision.collectionChangelog.description.length ? revision.collectionChangelog.description.substring(0, 500) : '__Not provided__')
            )
            .setURL(nexusModsTrackingUrl(`https://nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`, 'subscribedCollection'))
            .setThumbnail(collection.tileImage.url)
            .setTimestamp(new Date(revision.updatedAt))
            .setFooter({ text: `${collection.game.name} • ${revision.revisionNumber}`, iconURL: 'https://staticdelivery.nexusmods.com/mods/2295/images/26/26-1742212559-1470988141.png' })
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

        }
        break;
        default: embed.setDescription(`Unknown SubscribedItemType when building Embed: ${sub.type}`);

    }

    return embed;
}