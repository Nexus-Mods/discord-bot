import { IModInfo } from "@nexusmods/nexus-api";
import { AxiosError } from 'axios';
import { 
    GuildMember, APIEmbedField, 
    ActionRow, MessageActionRowComponent, EmbedBuilder
} from "discord.js";

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
    embeds?: EmbedBuilder[];
    components?: ActionRow<MessageActionRowComponent>[]; 
}

export class NexusAPIServerError implements Error {
    public code: number = -1;
    public name: string = 'Unknown Error';
    public message: string = 'An unknown network error occurred when communicating with the API.';
    public path?: string = undefined;
    public authType?: string = undefined;
    // public raw: Response;

    constructor(error: AxiosError, authType: 'OAUTH' | 'APIKEY', path?: string) {
        this.code = error.response?.status || -1;
        this.path = path;
        this.authType = authType;
        // this.raw = errorResponse;
        const errorType: string|undefined = error.response?.status.toString()[0];

        // Non-HTTP errors (possibly CloudFlare?)
        if (this.code > 599 || !errorType) return;

        // Server Error
        if (errorType === '5') {
            if (this.code === 504) {
                this.name = 'Request Timed Out'
                this.message = 'The request timed out before receiving a response from the server. This may be a temporary issue, please try again later.';
            }
            else {
                this.name = 'Internal Server Error'
                this.message = 'This may be a temporary issue, please try again later.';
            }
        }
        // Client Error
        else if (errorType === '4') {
            // Unauthorised
            if (this.code === 401) {
                this.name = 'Unauthorised';
                this.message = 'The API key linked with your account is invalid. Please use the /link command to update it.';
            }
            // Not found
            else if (this.code === 404) {
                this.name = 'Not found';
                this.message = 'The resource you are looking for does not appear to exist. Please check your spelling.';
            }
            // Another 4XX error, which we don't cater for specifically. 
            else {
                this.name = 'Client Error';
                this.message = `There was an issue with the request which caused the error code ${this.code}.`;
            }
        }
        else if (errorType === '1' || errorType === '3') {
            // There's not really any reason to encounter the 1xx and 3xx codes so we'll just catch them here. 
            this.name = `Unexpected HTTP response ${this.code}`;
            this.message = 'The server responded with an unexpected HTTP code.';
        }

    }
};