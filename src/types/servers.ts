import { Snowflake } from 'discord.js';

export interface BotServer {
    id: Snowflake;
    official: boolean;
    channel_nexus?: Snowflake;
    channel_news?: Snowflake;
    role_author?: Snowflake;
    game_filter?: string;
    server_owner: Snowflake;
}