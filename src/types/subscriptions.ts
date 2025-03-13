
import { Snowflake, TextChannel, WebhookClient } from 'discord.js';

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
    
    constructor(c: ISubscribedChannel) {
        this.id = c.id;
        this.guild_id = c.guild_id;
        this.channel_id = c.channel_id;
        this.webhook_id = c.webhook_id;
        this.webhook_token = c.webhook_token;
        this.last_update = c.last_update;
        this.created = c.created;

        this.webHookClient = new WebhookClient({ id: this.webhook_id, token: this.webhook_token});
    }

    async getSubscribedItems(skipCache: boolean = false): Promise<SubscribedItem[]> {
        if (!this.subscribedItems.length || skipCache) {
            // fetch from database
        }
        
        return this.subscribedItems;
    }


}

enum SubscribedItemType {
    Game = 'game',
    User = 'user',
    Mod = 'mod',
    Collection = 'collection'
}

export interface ISubscribedItem {
    id: number;
    parent: number;
    title: string;
    entityId: any;
    owner: Snowflake;
    last_update: Date;
    created: Date;
    crosspost: boolean;
    compact: boolean;
    message: string;
    error_count: number;
    nsfw?: boolean;
    sfw?: boolean;
}

export interface ISubscribedGameItem extends ISubscribedItem {
    entityId: string;
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
    entityId: string | number;
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
    message: string;
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

    constructor(item: ISubscribedItemUnionType) {
        this.id = item.id;
        this.type = item.type;
        this.title = item.title;
        this.entityId = item.entityId
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
    }

    public showAdult(channel: TextChannel): boolean {
        if ((this.type === SubscribedItemType.Game || this.type === SubscribedItemType.User) && this.nsfw !== undefined) return this.nsfw;
        else return channel.nsfw;
    }
}