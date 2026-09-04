import type { APIEmbed, Snowflake, TextChannel } from 'discord.js';
import type { CollectionStatus, ICollection, ICollectionRevision, IMod, IModFile } from '../api/queries/v2.js';
import type { ModStatus } from './GQLTypes.js';

export interface ISubscribedChannel {
    id: number;
    guild_id: Snowflake;
    channel_id: Snowflake;
    webhook_id: Snowflake;
    webhook_token: string;
    last_update: Date;
    created: Date;
}

/**
 * A row of SubscribedChannels, plus the items belonging to it.
 *
 * This used to be an active record: create(), getSubscribedItems(), subscribe() and
 * updateSub() all called api/subscriptions, which in turn constructs this class - the
 * import cycle that survived 3.6. It also built a WebhookClient in its constructor, so
 * reading a subscription meant constructing Discord I/O.
 *
 * Both are gone. The persistence operations are functions in api/subscriptions, the
 * webhook is built by the feed code that posts through it, and this holds data. The
 * dependency now points one way: storage knows about the model, the model knows nothing.
 *
 * `items` is still a mutable cache filled in by api/subscriptions rather than by a
 * repository that owns it. That is a smaller wart than a cycle and it preserves the
 * existing caching behaviour exactly; a repository is a redesign, not a move.
 */
export class SubscribedChannel implements ISubscribedChannel {
    id: number;
    guild_id: string;
    channel_id: string;
    webhook_id: string;
    webhook_token: string;
    last_update: Date;
    created: Date;

    /** Populated and refreshed by getSubscribedItems() in api/subscriptions. */
    public items: SubscribedItem<SubscribedItemType>[];

    constructor(c: ISubscribedChannel, items: SubscribedItem<SubscribedItemType>[] = []) {
        this.id = c.id;
        this.guild_id = c.guild_id;
        this.channel_id = c.channel_id;
        this.webhook_id = c.webhook_id;
        this.webhook_token = c.webhook_token;
        this.last_update = c.last_update;
        this.created = c.created;
        this.items = items;
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
        if (type === 'games') {
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

export type EntityType<T extends SubscribedItemType> = 
    T extends 'game' ? IMod :
    T extends 'mod' ? IModWithFiles:
    T extends 'collection' ? ICollection & { revisions?: ICollectionRevision[] } :
    T extends 'user' ? any : null;
