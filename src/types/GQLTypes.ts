import { GuildMember } from "discord.js";

type ID = number | string | bigint;
type ModStatus = 'under_moderation' | 'published' | 'not_published' | 'publish_with_game' | 'removed' | 'wastebinned' | 'hidden';


interface Mod {
    adult: boolean;
    author: string;
    // Possibly redundant? 
    category: string;
    createdAt: string;
    description: string;
    game: Partial<Game>;
    gameId: number;
    id: number;
    ipAddress?: string;
    modCategory: Partial<ModCategory>;
    modId: number;
    name: string;
    pictureUrl: string;
    status: ModStatus;
    summary: string;
    trackingData?: TrackingState;
    uid: ID;  
    updatedAt: string;
    uploader: Partial<User>;
    version: string;
}

interface FeedMod extends Mod {
    // Used on Gamefeeds where we append the Discord account to the object
    authorDiscord?: GuildMember | null;
    // Add the latest file update time from the v1 API response. 
    lastFileUpdate?: number;
}

interface ModCategory {
    date: number;
    gameId: number;
    id: ID;
    name: string;
    tags: string;
}

interface Game {
    availableTags: Partial<Tag>[];
    collectionCount: number;
    domainName: string;
    id: number;
    name: string;
    specificTags: Partial<Tag>[];
}

interface User {
    avatar: string;
    deleted: boolean;
    dpOptedIn: boolean;
    email: string;
    ipAddress: string;
    kudos: number;
    memberId: number;
    name: string;
    paypal: string;
    posts: number;
    recognizedAuthor: boolean;
}

interface Tag {
    adult: boolean;
    category: TagCategory;
    createdAt: string;
    discardedAt: Date;
    games: Partial<Game>[];
    global: boolean;
    id: ID;
    name: string;
    taggablesCount: number;
    updatedAt: string;
}

interface TagCategory {
    createdAt: Date;
    discardedAt: Date;
    id: ID;
    name: string;
    tags: Partial<Tag>[];
    updatedAt: string;
}

interface TrackingState {
    test: number;
}

export { Mod, Game, User, Tag, FeedMod }