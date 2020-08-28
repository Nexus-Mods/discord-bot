
export interface GameFeed extends Feed {
    domain: string;
    title: string;
    nsfw: boolean;
    sfw: boolean;
    show_new: boolean;
    show_updates: boolean;
    compact: boolean;
    message: string;
    
}

export interface ModFeed extends Feed {
    domain: string;
    mod_id: number;
    title: string;
    show_files: boolean;
    show_other: boolean;
    last_timestamp: Date;
    last_status: string;
    message: string;
    created: Date;
}

interface Feed {
    _id: number;
    channel: string;
    guild: string;
    owner: string;
    webhook_id?: string;
    webhook_token?: string;
    last_timestamp: Date;
    created?: Date;
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