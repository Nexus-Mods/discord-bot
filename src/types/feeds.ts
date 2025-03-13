
import { Snowflake, TextChannel } from 'discord.js';

// Experimental Types

export interface ISubscribedChannel {
    id: number;
    guild_id: Snowflake;
    channel_id: Snowflake;
    webhook_id: Snowflake;
    webhook_token: string;
    last_update: Date;
    created: Date;
}

type SubscribedItemType = 'game' | 'user' | 'mod' | 'collection';

export interface ISubscribedItem {
    id: number;
    parent: number; // The ISubscribedChannel that owns this item
    type: SubscribedItemType;
    title: string;
    owner: Snowflake;
    last_update: Date;
    created: Date;
    crosspost: boolean;
    compact: boolean;
    message: string;
    error_count: number;
    nsfw?: boolean;
    sfw?: boolean;
    show_new?: boolean;
    show_updates?: boolean;
}

export class SubscribedItem implements ISubscribedItem {
    // Database identiifier
    id : number;
    // Parent channel DB identifier
    parent: number;
    // What kind of item are we subbed to?
    type: SubscribedItemType;
    // Displayable title without re-fetching
    title: string;
    owner: string;
    last_update: Date;
    created: Date;
    crosspost: boolean;
    compact: boolean;
    message: string;
    error_count: number;
    nsfw?: boolean;
    sfw?: boolean;
    show_new?: boolean;
    show_updates?: boolean;

    constructor(item: ISubscribedItem) {
        this.id = item.id;
        this.type = item.type;
        this.title = item.title;
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
        this.show_new = item.show_new;
        this.show_updates = item.show_updates;    }

    public isGame(): boolean {
        return (this.type === 'game');
    } 

    public isUser(): boolean {
        return (this.type === 'user');
    } 

    public isMod(): boolean {
        return (this.type === 'mod');
    } 

    public isCollection(): boolean {
        return (this.type === 'collection');
    } 

    public showAdult(channel: TextChannel): boolean {
        if ((this.isGame() || this.isUser()) && this.nsfw !== undefined) return this.nsfw;
        else return channel.nsfw;
    }
}

// End Experiment

export interface GameFeed extends Feed {
    domain: string;
    nsfw: boolean;
    sfw: boolean;
    show_new: boolean;
    show_updates: boolean;
    // Added collections to the mix. 
    // show_new_collections: boolean;
    // show_updated_collections: boolean;
}

export interface ModFeed extends Feed {
    domain: string;
    mod_id: number;
    latest_file_id: number;
    last_status: string;
}

export interface CollectionFeed extends Feed {
    domain: string;
    slug: string;
    latest_revision: number;
    last_status: string;
}

export interface Feed {
    _id: number;
    title: string;
    channel: Snowflake;
    guild: Snowflake;
    owner: Snowflake;
    webhook_id?: Snowflake;
    webhook_token?: string;
    last_timestamp: Date;
    created: Date;
    error_count: number;
    crosspost: boolean;
    compact: boolean;
    message: string;
    isGameFeed(): this is GameFeed;
    isModFeed(): this is ModFeed;
    isCollectionFeed(): this is CollectionFeed;
}

export interface NewsArticle {
    title: string;
    author: string;
    categories: string[];
    link: string;
    date: Date;
    pubDate: Date;
    enclosure: {
        url: string;
    }
    'nexusmods:plain_description': string;
}

export interface INews {
    id: string;
    title: string;
    summary: string;
    newsCategory: {
        name: string;
    }
    date: string;
    author: {
        name: string;
        avatar: string;
    }
    header: string;
    image: string;
}

export class News implements INews {
    id: string;
    title: string;
    summary: string;
    date: string;
    author: { name: string; avatar: string; };
    header: string;
    image: string;
    newsCategory: { name: string; };
    private baseImageUrl: string = 'https://staticdelivery.nexusmods.com/images/News/';
    public publishDate: Date;
    public headerUrl: string;
    public imageUrl: string;

    constructor(newsItem: INews) {
        this.id = newsItem.id;
        this.title = newsItem.title;
        this.summary = newsItem.summary;
        this.date = newsItem.date;
        this.author = newsItem.author;
        this.header = newsItem.header;
        this.image = newsItem.image;
        this.publishDate = new Date(newsItem.date)
        this.headerUrl = `${this.baseImageUrl}/${newsItem.header}`;
        this.imageUrl = `${this.baseImageUrl}/${newsItem.image}`;
        this.newsCategory = newsItem.newsCategory;
    }

    public url(gameDomain?: string): string {
        return `https://nexusmods.com/${gameDomain ? `${gameDomain}/`: ''}news/${this.id}`;
    }
    
}

export interface SavedNewsData {
    title: string;
    date: Date;
}