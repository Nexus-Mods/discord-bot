export interface BotServer {
    id: string;
    official: boolean;
    channel_bot?: string;
    channel_nexus?: string;
    channel_log?: string;
    channel_news?: string;
    role_author?: string;
    role_premium?: string;
    role_supporter?: string;
    role_linked?: string;
    author_min_downloads: number;
    game_filter?: number;
    search_whid?: string;
    search_whtoken?: string;
    server_owner: string;
}