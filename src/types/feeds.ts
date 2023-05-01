
import { Snowflake } from 'discord.js';

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

export interface SavedNewsData {
    title: string;
    date: Date;
}