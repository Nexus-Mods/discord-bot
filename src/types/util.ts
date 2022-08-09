import { IModInfo } from "@nexusmods/nexus-api";
import { 
    Collection, GuildMember, Embed, APIEmbedField, Snowflake, ApplicationCommandData, 
    CommandInteraction, Client, UserContextMenuCommandInteraction, MessageContextMenuCommandInteraction, ActionRow, MessageActionRowComponent
} from "discord.js";
import { GameFeedManager } from "../feeds/GameFeedManager";
import { ModFeedManager } from "../feeds/ModFeedManager";
import { NewsFeedManager } from "../feeds/NewsFeedManager";

export interface InfoResult {
    name: string;
    message?: string;
    title?: string;
    description?: string; 
    url?: string;
    timestamp?: Date;
    thumbnail?: string;
    image?: string;
    fields?: APIEmbedField[];
    approved?: boolean;
    author?: string;
}

export interface ModDownloadInfo {
    id: number,
    total_downloads: number,
    unique_downloads: number
}

export interface IModInfoExt extends IModInfo {
    authorDiscord?: GuildMember|null;
}

export interface CommandHelp {
    name: string;
    usage: string;
    description: string;
    adminOnly: boolean;
    moderatorOnly: boolean;
    officialOnly?: boolean;
}

export interface NexusSearchResult {
    terms: string[];
    exclude_authors: string[];
    include_adult: boolean;
    took: number;
    total: number;
    results: NexusSearchModResult[]
    fullSearchURL?: string;
}

export interface NexusSearchModResult {
    name: string;
    downloads: number;
    endorsements: number;
    url: string;
    image: string;
    username: string;
    user_id: number;
    game_name: string;
    game_id: number;
    mod_id: number;
}

export interface InfoCache {
    expiry: Date;
    data: InfoResult[];
}

export interface PostableInfo {
    content?: string;
    embeds?: Embed[];
    components?: ActionRow<MessageActionRowComponent>[]; 
}

interface PermissionsExt {
    guild?: Snowflake;
    id: Snowflake;
    type: 'USER' | 'ROLE';
    permission: boolean;
}

export type DiscordInteractionType = 
| UserContextMenuCommandInteraction 
| MessageContextMenuCommandInteraction 
| CommandInteraction;

export interface DiscordInteraction {
    command: ApplicationCommandData;
    action: (client: Client, interact: DiscordInteractionType) => Promise<void>;
    public: boolean;
    guilds?: Snowflake[];
    permissions?: PermissionsExt[];
}

export interface ClientExt extends Client {
    config?: any;
    commands?: Collection<any, any>;
    interactions?: Collection<any, any>;
    gameFeeds?: GameFeedManager;
    modFeeds?: ModFeedManager;
    newsFeed?: NewsFeedManager;
}