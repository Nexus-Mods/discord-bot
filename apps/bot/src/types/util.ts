import { other } from "@nexusmods/nexus-api/queries/all.js";
import type { Logger } from "@nexusmods/core/logger.js";
import { logger } from "@nexusmods/core/logger.js";
import type { IGameStatic } from "@nexusmods/nexus-api/queries/other.js";
import type { ITip } from "../api/tips.js";
import { getAllTips } from "../api/tips.js";

// Custom Emojis from discord.gg/nexusmods that may be used by the bot.
export const customEmojis = {
    mod: '1075460802481504286',
    collection: '1075460772378980362',
    nexus: '1003658013476929567',
    vortex: '495527799017439232'
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


export enum ConditionType {
    modDownloads = 'mod downloads',
    modsPublished = 'mods published'
}