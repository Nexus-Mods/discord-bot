import { other } from "../api/queries/all.js";
import type { Logger } from "../api/util.js";
import { logger } from "../api/logger.js";
import type { IGameStatic } from "../api/queries/other.js";
import type { ITip } from "../api/tips.js";
import { getAllTips } from "../api/tips.js";

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

export class GameListCache {
    public dateStamp: number;
    public games: IGameStatic[];

    constructor() {
        this.dateStamp = -1;
        this.games = [];
    }

    async init(logger: Logger): Promise<GameListCache> {
        try {
            await this.getGames();
            return this;
        }
        catch(err) {
            logger.error('Error initialising game cache', err);
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
        // Constructor cannot await; without a catch this was an unhandled rejection.
        getAllTips()
        .then( t =>  {
            this.tips = t;
            this.setNextUpdate();
        })
        .catch((err) => logger.warn('Could not pre-load the tip cache', err));
    }

    private setNextUpdate(): void {
        this.nextUpdate = new Date().getTime() + 300000
    }

    private async fetchTips(limit?: 'approved' | 'unapproved'): Promise<ITip[]> {
        if (!this.tips.length || new Date().getTime() >= this.nextUpdate) {
            this.tips = await getAllTips();
            this.setNextUpdate();
        }
        switch(limit){
            case 'approved' : return this.tips.filter(t => t.approved === true);
            case 'unapproved' : return this.tips.filter(t => t.approved === false);
            default: return this.tips;
        }
    }

    public async bustCache(): Promise<void> {
        this.tips = await getAllTips();
        this.setNextUpdate();
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

export enum ConditionType {
    modDownloads = 'mod downloads',
    modsPublished = 'mods published'
}