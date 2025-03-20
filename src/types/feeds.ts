
import { Snowflake } from 'discord.js';

export interface GameFeed extends Feed {
    domain: string;
    nsfw: boolean;
    sfw: boolean;
    show_new: boolean;
    show_updates: boolean;
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
    id: number;
}