import { GameFeed } from '../types/feeds';
import { getAllGameFeeds, getGameFeed, createGameFeed, deleteGameFeed, getUserByDiscordId, getUserByNexusModsName, updateGameFeed } from '../api/bot-db';
import { ClientExt } from "../types/DiscordTypes";
import { IUpdateEntry, IChangelogs } from '@nexusmods/nexus-api';
import { User, Guild, Snowflake, TextChannel, WebhookClient, GuildMember, EmbedBuilder, Client, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, NewsChannel, GuildBasedChannel } from 'discord.js';
import { logMessage, nexusModsTrackingUrl } from '../api/util';
import { NexusAPIServerError } from '../types/util';
import { DiscordBotUser, DummyNexusModsUser } from '../api/DiscordBotUser';
import { IMod, IModFile } from '../api/queries/v2';
import { IGameStatic } from '../api/queries/other';
import { IPostableSubscriptionUpdate, ISubscribedItem, SubscribedChannel, SubscribedItem, subscribedItemEmbed, SubscribedItemType, SubscriptionCache } from '../types/subscriptions';
import { ensureSubscriptionsDB, getAllSubscriptions, getSubscribedChannels } from '../api/subscriptions';

// const pollTime: number = (1000*60*10); //10 mins

export class SubscriptionManger {
    private static instance: SubscriptionManger;
    private client: ClientExt;
    private updateTimer: NodeJS.Timeout;
    private pollTime: number; //10 mins
    private channels: SubscribedChannel[];
    private cache: SubscriptionCache = new SubscriptionCache();
    private fakeUser: DiscordBotUser = new DiscordBotUser(DummyNexusModsUser);

    private constructor(client: ClientExt, pollTime: number, channels: SubscribedChannel[]) {
        // Save the client for later
        this.client = client;
        this.pollTime = pollTime;
        this.updateTimer = setInterval(async () => {
            try {
                await this.updateSubscriptions();
            }
            catch(err){
                logMessage('Failed to run subscription event', err, true);
            }
        }, pollTime)
        this.channels = channels;
        // Kick off an update.
        this.updateSubscriptions(true);
    }

    static async getInstance(client: ClientExt, pollTime: number = (1000*60*10)): Promise<SubscriptionManger> {
        if (!SubscriptionManger.instance) {
            await SubscriptionManger.initialiseInstance(client, pollTime);
        }
        return SubscriptionManger.instance;
    }

    private static async initialiseInstance(client: ClientExt, pollTime: number): Promise<void> {
        // Set up any missing tables
        try {
            await ensureSubscriptionsDB();
            const channels = await getSubscribedChannels();
            SubscriptionManger.instance = new SubscriptionManger(client, pollTime, channels);
        }
        catch(err) {
            throw err;
        }
    }

    private async updateChannels() {
        this.channels = await getSubscribedChannels();
        return;
    }

    private async updateSubscriptions(firstRun: boolean = false) {
        // Update the channels
        if (!firstRun) await this.updateChannels();
        // Prepare the cache
        await this.prepareCache();

        // Process the channels and their subscribed items.
        for (const channel of this.channels) {
            // Verify the channel exists
            const guild = await this.client.guilds.fetch(channel.guild_id)
            const discordChannel: TextChannel | null = await guild.channels.fetch(channel.channel_id) as TextChannel;
            if (!guild || !discordChannel) {
                logMessage('Discord channel not found to post subscriptions', { guild: guild?.name, channelId: channel.channel_id });
                continue;
            }
            else logMessage(`Processing subscribed items for ${discordChannel.name} in ${guild.name}`)
            // Grab the WH Client
            const webHookClient = channel.webHookClient;
            // Grab the subscribed items
            const items = await channel.getSubscribedItems();
            // Get the postable info for each subscribed item
            const postableUpdates: IPostableSubscriptionUpdate<any>[] = [];
            for (const item of items) {
                let updates: IPostableSubscriptionUpdate<typeof item.type>[] = [];
                
                // Logic based on subscription type here.
                switch (item.type) {
                    case SubscribedItemType.Game: updates = await this.getGameUpdates(item);
                    break;
                    case SubscribedItemType.Mod:updates = await this.getModUpdates(item);
                    break;
                    case SubscribedItemType.Collection: updates = await this.getCollectionUpdates(item);
                    break;
                    case SubscribedItemType.User: updates = await this.getUserUpdates(item);
                    break;
                    default: throw new Error('Unregcognised SubscribedItemType: '+item.type)
                }

                // Format the items into a generic type for comparison. 
                postableUpdates.push(...updates);
            }
        }

        // Empty the cache
        this.cache = new SubscriptionCache();        
    }

    private async getGameUpdates(item: SubscribedItem): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Game>[]> {
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Game>[] = [];
        const domain: string = item.entityId as string;
        const last_update = item.last_update;
        let newMods = item.show_new ? this.cache.games.new[domain].filter(m => new Date(m.createdAt) >= last_update ): [];
        // If there's nothing in the cache, we'll double check
        if (!newMods.length && item.show_new) {
            const res = await this.fakeUser.NexusMods.API.v2.Mods(
                { 
                    gameDomainName: { value: domain, op: 'EQUALS' },
                    createdAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GTE' }
                }, 
                { createdAt: { direction: 'ASC' } }
            );
            newMods = res.nodes;
        }
        // Map into the generic format.
        const formattedNew = newMods.map(m => (
            { 
                type: SubscribedItemType.Game, 
                date: new Date(m.createdAt), 
                entity: m, 
                embed: subscribedItemEmbed(SubscribedItemType.Game, m, item) 
            }
        ));
        results.push(...formattedNew);

        let updatedMods: (IMod & { files?: IModFile[]})[] = item.show_updates ? this.cache.games.updated[domain].filter(m => new Date(m.updatedAt) >= last_update ): [];
        // If there's nothing in the cache, we'll double check
        if (!updatedMods.length && item.show_updates) {
            const res = await this.fakeUser.NexusMods.API.v2.Mods(
                { 
                    gameDomainName: { value: domain, op: 'EQUALS' },
                    updatedAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GTE' },
                    hasUpdated: { value: true, op: 'EQUALS' }
                }, 
                { createdAt: { direction: 'ASC' } }
            );
            updatedMods = res.nodes;
            // Get the file lists (including changelogs)
        }
        // Attach a list of files
        for (const mod of updatedMods) {
            const files = this.cache.getCachedModFiles(mod.uid) ?? await this.fakeUser.NexusMods.API.v2.ModFiles(mod.game.id, mod.modId);
            mod.files = files;
            this.cache.add('modFiles', files, mod.uid);
        }
        // Map into the generic format.
        const formattedUpdates = updatedMods.map(m => (
            { 
                type: SubscribedItemType.Game, 
                date: new Date(m.createdAt), 
                entity: m, 
                embed: subscribedItemEmbed(SubscribedItemType.Game, m, item, true) 
            }
        ));
        results.push(...formattedUpdates);

        // Order the results.
        return results.sort((a,b) => a.date.getTime() - b.date.getTime());
    }

    private async getModUpdates(item: SubscribedItem): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Mod>[]> {
        return [];
    } 

    private async getCollectionUpdates(item: SubscribedItem): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Collection>[]> {
        return [];
    } 

    private async getUserUpdates(item: SubscribedItem): Promise<IPostableSubscriptionUpdate<SubscribedItemType.User>[]> {
        return [];
    } 

    private async prepareCache() {
        const subs = await getAllSubscriptions();

        const promises: Promise<void>[] = [];

        // NEW MODS FOR GAMES 
        const newGameSubs = subs.filter(s => s.type === SubscribedItemType.Game && s.show_new);
        const newGames = new Set<string>(newGameSubs.map(s => s.entityId as string));
        // For each game, get the date of the oldest possible mod to show.
        const oldestPerNewGame = getMaxiumDatesForGame(newGameSubs, newGames);
        const newGamePromises = Object.entries(oldestPerNewGame).map(async ([ domain, date ]) => {
            const mods = await this.fakeUser.NexusMods.API.v2.Mods(
                {
                    gameDomainName: { value: domain, op: 'EQUALS' },
                    createdAt: { value: Math.floor(date.getTime()/1000).toString(), op: 'GTE' }
                },
                { createdAt: { direction: 'ASC' } }
            );
            this.cache.add('games', mods.nodes, domain);
            logMessage(`Pre-cached ${mods.nodes.length}/${mods.totalCount} new mods for ${domain}`)
        });
        promises.push(...newGamePromises);

        // UPDATED MODS FOR GAMES
        const updatedGameSubs = subs.filter(s => s.type === SubscribedItemType.Game && s.show_updates);
        const updatedGames = new Set<string>(updatedGameSubs.map(s => s.entityId as string));
        const oldestPerUpdatedGame = getMaxiumDatesForGame(updatedGameSubs, updatedGames);
        const updatedGamePromises = Object.entries(oldestPerUpdatedGame).map(async ([ domain, date ]) => {
            const mods = await this.fakeUser.NexusMods.API.v2.Mods(
                {
                    gameDomainName: { value: domain, op: 'EQUALS' },
                    updatedAt: { value: Math.floor(date.getTime()/1000).toString(), op: 'GTE' },
                    hasUpdated: { value: true, op:'EQUALS' }
                },
                { updatedAt: { direction: 'ASC' } }
            );
            this.cache.add('games', mods.nodes, domain, true);
            logMessage(`Pre-cached ${mods.nodes.length}/${mods.totalCount} updated mods for ${domain}`)
        });
        promises.push(...updatedGamePromises);

        // TODO - We could cache the values of common mods, users and collections here, but it's an improvement.

        // Let all the promises resolve
        return await Promise.all(promises);
    }
}

function getMaxiumDatesForGame(subs: ISubscribedItem[], games: Set<string>) {
    return [...games].reduce<{ [domain: string]: Date }>(
        (prev, cur) => {
        const subsForDomain = subs.filter(g => g.entityId === cur);
        const oldest = subsForDomain.sort((a,b) => a.last_update.getTime() - b.last_update.getTime())[0]
        prev[cur] = oldest.last_update;
        return prev;
        },
    {});
}