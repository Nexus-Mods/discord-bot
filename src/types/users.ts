import { Snowflake } from 'discord.js';

interface NexusUser {
    d_id: Snowflake;
    id: number;
    name: string;
    avatar_url?: string;
    apikey: string;
    supporter: boolean;
    premium: boolean;
    modauthor?: boolean;
    lastupdate?: Date;
    servers?: NexusUserServerLink[];
    nexus_access?: string;
    nexus_refresh?: string;
    nexus_expires?: Date;
}

interface NexusUserServerLink {
    user_id: number;
    server_id: Snowflake;
}

interface NexusLinkedMod {
    domain: string;
    mod_id: number;
    name: string;
    game: string;
    unique_downloads: number;
    total_downloads: number;
    path: string;
    owner: number;
}

export { NexusUser, NexusUserServerLink, NexusLinkedMod };