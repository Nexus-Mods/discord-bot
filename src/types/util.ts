import { IModInfo } from "@nexusmods/nexus-api";
import { GuildMember } from "discord.js";

export interface PostableInfo {
    name: string;
    message?: string;
    title?: string;
    description?: string; 
    url?: string;
    timestamp?: Date;
    thumbnail?: string;
    image?: string;
    fields?: {name: string, value: string, inline?: boolean}[];
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