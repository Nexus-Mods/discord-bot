import { ModFeed } from '../types/feeds';
import { getAllModFeeds, getModFeed, createModFeed, deleteModFeed } from '../api/bot-db';
import { ClientExt } from "../types/DiscordTypes";

const pollTime = (1000*60*60); //1 hour

export class ModFeedManager {
    private static instance: ModFeedManager;

    private ModFeeds: ModFeed[] = [];
    private client: ClientExt;
    // private updateTimer: NodeJS.Timeout;

    static getInstance(client: ClientExt): ModFeedManager {
        if (!ModFeedManager.instance) {
            ModFeedManager.instance = new ModFeedManager(client);
        }

        return ModFeedManager.instance;
    }

    private constructor(client: ClientExt) {
        // Save the client for later
        this.client = client;
        // Set the update interval.
        // this.updateTimer = setInterval(this.updateFeeds, pollTime);
        this.getFeeds()
            .then(() => {
                console.log(`${new Date().toLocaleString()} - Initialised with ${this.ModFeeds.length} mod feeds, checking every ${pollTime/1000/60} minutes`);
            })
            .catch((err) => console.error('Error in ModFeedManager contructor', err));
    }

    private async getFeeds(): Promise<ModFeed[]> {
        this.ModFeeds = await getAllModFeeds();
        return this.ModFeeds;
    }

    async updateAll(): Promise<void> {
        await this.getFeeds();
        await this.updateFeeds();
        // clearInterval(this.updateTimer);
        // this.updateTimer = setInterval(this.updateFeeds, pollTime);
    }

    getAllFeeds(): ModFeed[] {
        return this.ModFeeds;
    }

    async getFeed(id: number): Promise<ModFeed | undefined> {
        const feed = this.ModFeeds.find((f: ModFeed) => f._id === id);
        return feed || await getModFeed(id);
    }

    async create(newFeed: ModFeed): Promise<number> {
        try {
            const id = await createModFeed(newFeed);
            return id;
        }
        catch (err) {
            return await Promise.reject(err);
        }
    }

    async deleteFeed(id: number): Promise<void> {
        const feed = this.ModFeeds.find((f: ModFeed) => f._id === id);
        if (!feed) return Promise.resolve();
        await deleteModFeed(feed._id);
        this.getFeeds();
        return;
    }

    async updateFeeds(): Promise<void> {
        return Promise.reject('Mod feeds currently inactive.');
        if (!this.ModFeeds.length) await this.getFeeds();
        const client: ClientExt = this.client;

        // TODO! - Do the update for each feed.
        Promise.all(this.ModFeeds
                .map((feed: ModFeed) => checkForGameUpdates(this.client, feed).catch((err: Error) => console.warn('Error checking game feed', feed._id, err.message)))
        ).then(() => { console.log(`${new Date().toLocaleString()} - Finished checking mod feeds.`) });

    }
}

async function checkForGameUpdates(client: ClientExt, feed: ModFeed): Promise<void> {
    // We'll need to get all games from the Nexus Mods API.
    let allGames;

    //console.log(`${new Date().toLocaleString()} - Checking game feed #${feed._id} for updates (${feed.title}) in ${feedGuild}`)
}