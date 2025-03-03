import { IModInfo } from "@nexusmods/nexus-api";
import { AxiosError } from 'axios';
import { 
    GuildMember, APIEmbedField, 
    ActionRow, MessageActionRowComponent, EmbedBuilder
} from "discord.js";
import { other } from "../api/queries/all";
import { logMessage } from "../api/util";
import { IGameStatic } from "../api/queries/other";
import { getAllTips, ITip } from "../api/tips";

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

// Custom Emojis from discord.gg/nexusmods that may be used by the bot.
export const customEmojis = {
    mod: '1075460802481504286',
    collection: '1075460772378980362',
    nexus: '1003658013476929567',
    vortex: '495527799017439232'
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
            // Bad Request
            if (this.code === 400) {
                this.name = 'Bad Request';
                this.message = 'The request is invalid. This could be an issue with your account link, try unlinking and relinking.';
            }
            // Unauthorised
            if (this.code === 401) {
                this.name = 'Unauthorised';
                this.message = 'The API key or OAuth token for your account is not authorised to make this request. Please use the /link command to update it.';
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

export class GameListCache {
    public dateStamp: number;
    public games: IGameStatic[];

    constructor() {
        this.dateStamp = -1;
        this.games = [];
    }

    async init(): Promise<GameListCache> {
        try {
            await this.getGames();
            return this;
        }
        catch(err) {
            logMessage('Error initialising game cache', err, true);
            return this;
        }
    }

    async getGames(): Promise<IGameStatic[]> {
        if (this.games.length && this.dateStamp > Date.now()) {
            return this.games;
        }
        else {
            const games = await other.Games({});
            this.games = games.sort((a, b) => a.downloads > b.downloads ? -1 : 1);
            this.dateStamp = Date.now() + 300000;
            return games;
        }
    }
}

export class TipCache {
    private tips : ITip[] = [];
    private nextUpdate: number = new Date().getTime() + 10000;

    constructor() {
        getAllTips()
        .then( t =>  {
            this.tips = t;
            this.setNextUpdate();
        });
    }

    private setNextUpdate(): void {
        this.nextUpdate = new Date().getTime() + 300000
    }

    private async fetchTips(limit?: 'approved' | 'unapproved'): Promise<ITip[]> {
        if (new Date().getTime() > this.nextUpdate) {
            logMessage("Recaching tips")
            this.tips = await getAllTips();
            this.setNextUpdate();
        }
        else logMessage("Using cached tips "+new Date(this.nextUpdate).toLocaleDateString());
        switch(limit){
            case 'approved' : return this.tips.filter(t => t.approved === true);
            case 'unapproved' : return this.tips.filter(t => t.approved === true);
            default: return this.tips;
        }
    }
    
    public async getApprovedTips(): Promise<ITip[]> {
        return await this.fetchTips('approved');
    }

    public async getPendingTips(): Promise<ITip[]> {
        return await this.fetchTips('unapproved');
    }

    public async getTips(): Promise<ITip[]> {
        return await this.fetchTips();
    }
}

export interface IAutomodRule {
    id: number;
    type: 'low' | 'high';
    filter: string;
    added: Date;
    reason: string;
}

export interface IBadFileRule {
    id: number;
    type: 'low' | 'high';
    funcName: 'includes' | 'startsWith' | 'endsWith' | 'match';
    test: string;
    flagMessage: string;
}

export type StatusPageResponse<T extends boolean> = T extends true ? IStatusPageFullResponse : IStatusPageQuickResponse;

type StatusPageComponentStatus = 'operational' | 'partial_outage' | string;
type StatusPageIncidentStatus = 'identified' | 'investigating' | 'scheduled' | 'in_progress' | string;
type StatusPageImpact = 'major' | 'critical' | 'minor' | 'none' | string;
type StatusPageIndicator = 'minor' | string;

interface IStatusPageQuickResponse {
    page: {
        id: string;
        name: string;
        url: string;
        time_zone: string;
        updated_at: string;
    }
    status: {
        indicator: StatusPageIndicator;
        description: string;
    }
}

export interface IStatusPageFullResponse extends IStatusPageQuickResponse {
    components: IStatusPageComponent[];
    incidents: IStatusPageIncident[];
    scheduled_maintenances: IStatusPageIncident[];
}

interface IStatusPageComponent {
    id: string;
    name: string;
    status: StatusPageComponentStatus;
    created_at: string;
    updated_at: string;
    position: number;
    description: string;
    showcase: boolean;
    start_date: string;
    group_id: string | null;
    page_id: string;
    group: boolean;
    only_show_if_degraded: boolean;
}

interface IStatusPageIncident {
    id: string;
    name: string;
    status: StatusPageIncidentStatus;
    created_at: string;
    updated_at: string;
    monitoring_at: string | null;
    resolved_at: string | null;
    impact: StatusPageImpact;
    shortlink: string;   
    started_at: string;
    page_id: string;
    incident_updates: IStatusPageIncidentUpdate[];
}

interface IStatusPageIncidentUpdate {
    id: string;
    status: StatusPageIncidentStatus;
    body: string;
    incident_id: string;
    created_at: string;
    updated_at: string;
    display_at: string;    
    affected_components: {
        code: string;
        name: string;
        old_status: string;
        new_status: string;
    }[]
}