import { Snowflake } from 'discord.js';

interface NexusUser {
    d_id: Snowflake;
    id: number;
    name: string;
    avatar_url?: string;
    supporter: boolean;
    premium: boolean;
    modauthor?: boolean;
    lastupdate?: Date;
    nexus_access?: string;
    nexus_refresh?: string;
    nexus_expires?: number;
    discord_access?: string;
    discord_refresh?: string;
    discord_expires?: number;
}


export { NexusUser };