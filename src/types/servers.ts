import { Snowflake } from 'discord.js';

export interface BotServer {
    id: Snowflake;
    official: boolean;
    channel_bot?: Snowflake;
    channel_nexus?: Snowflake;
    channel_log?: Snowflake;
    channel_news?: Snowflake;
    role_author?: Snowflake;
    role_premium?: Snowflake;
    role_supporter?: Snowflake;
    role_linked?: Snowflake;
    author_min_downloads?: string;
    game_filter?: number;
    server_owner: Snowflake;
}