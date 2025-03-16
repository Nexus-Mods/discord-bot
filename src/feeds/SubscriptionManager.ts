import { ClientExt } from "../types/DiscordTypes";
import { Guild, TextChannel,  WebhookMessageCreateOptions } from 'discord.js';
import { logMessage } from '../api/util';
import { DiscordBotUser, DummyNexusModsUser } from '../api/DiscordBotUser';
import { IMod, IModFile } from '../api/queries/v2';
import { IPostableSubscriptionUpdate, ISubscribedItem, SubscribedChannel, SubscribedItem, subscribedItemEmbed, SubscribedItemType, SubscriptionCache } from '../types/subscriptions';
import { ensureSubscriptionsDB, getAllSubscriptions, getSubscribedChannels, updateSubscribedChannel } from '../api/subscriptions';

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
        logMessage('Subscription Manager initialised', { channels: SubscriptionManger.instance.channels.length});
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
            if (!items.length) continue;
            // Get the postable info for each subscribed item
            const postableUpdates: IPostableSubscriptionUpdate<any>[] = [];
            for (const item of items) {
                let updates: IPostableSubscriptionUpdate<typeof item.type>[] = [];
                
                // Logic based on subscription type here.
                switch (item.type) {
                    case SubscribedItemType.Game: updates = await this.getGameUpdates(item, guild);
                    break;
                    case SubscribedItemType.Mod:updates = await this.getModUpdates(item, guild);
                    break;
                    case SubscribedItemType.Collection: updates = await this.getCollectionUpdates(item, guild);
                    break;
                    case SubscribedItemType.User: updates = await this.getUserUpdates(item, guild);
                    break;
                    default: throw new Error('Unregcognised SubscribedItemType: '+item.type)
                }

                // Format the items into a generic type for comparison. 
                postableUpdates.push(...updates);
            }

            // Got all the updates - break them into groups by type and limit to 10 (API limit).
            const blocks: WebhookMessageCreateOptions[] = [{ embeds: [] }]
            let currentType: SubscribedItemType = postableUpdates[0].type;
            for (const update of postableUpdates) {
                // If we've swapped type or we've got more than 10 embeds already
                if (update.type !== currentType || blocks[blocks.length - 1].embeds!.length === 10) blocks.push({ embeds: [] })
                const myBlock = blocks[blocks.length - 1];
                myBlock.embeds = myBlock.embeds ? [...myBlock.embeds, update.embed] : [update.embed];
                if (!myBlock.content && update.message) myBlock.content = update.message;
                currentType = update.type;
            }

            // Send the updates to the webhook!
            logMessage(`Posting ${blocks.length} webhook updates to ${guild.name}`);
            for (const block of blocks) {
                try {
                    await webHookClient.send(block);
                }
                catch(err) {
                    logMessage('Failed to send webhook message', { block, err }, true);
                }
            }

            // Update the last updated time for the channel.
            const lastUpdate = postableUpdates[postableUpdates.length - 1].date;
            try {
                await updateSubscribedChannel(channel, lastUpdate);
            }
            catch(err) {
                logMessage('Failed to update channel date', err, true);
            }
        }

        // Empty the cache
        this.cache = new SubscriptionCache();        
    }

    private async getGameUpdates(item: SubscribedItem, guild: Guild): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Game>[]> {
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Game>[] = [];
        const domain: string = item.entityid as string;
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
        const formattedNew: IPostableSubscriptionUpdate<SubscribedItemType.Game>[] = [];
        for (const mod of newMods) {
            const embed = await subscribedItemEmbed(mod, item, guild);
            formattedNew.push({ 
                type: SubscribedItemType.Game, 
                date: new Date(mod.createdAt), 
                entity: mod, 
                embed,
                message: item.message ?? null
            })
        }
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
        const formattedUpdates: IPostableSubscriptionUpdate<SubscribedItemType.Game>[] = [];
        for (const mod of updatedMods) {
            const embed = await subscribedItemEmbed(mod, item, guild, true);
            formattedUpdates.push({ 
                type: SubscribedItemType.Game, 
                date: new Date(mod.updatedAt), 
                entity: mod, 
                embed,
                message: item.message ?? null
            })
        }
        results.push(...formattedUpdates);

        // TODO! - Save the last date so we know where to start next time!


        // Order the results.
        return results.sort((a,b) => a.date.getTime() - b.date.getTime());
    }

    private async getModUpdates(item: SubscribedItem, guild: Guild): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Mod>[]> {
        return [];
    } 

    private async getCollectionUpdates(item: SubscribedItem, guild: Guild): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Collection>[]> {
        return [];
    } 

    private async getUserUpdates(item: SubscribedItem, guild: Guild): Promise<IPostableSubscriptionUpdate<SubscribedItemType.User>[]> {
        return [];
    } 

    private async prepareCache() {
        const subs = await getAllSubscriptions();

        const promises: Promise<void>[] = [];

        // NEW MODS FOR GAMES 
        const newGameSubs = subs.filter(s => s.type === SubscribedItemType.Game && s.show_new);
        const newGames = new Set<string>(newGameSubs.map(s => s.entityid as string));
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
        const updatedGames = new Set<string>(updatedGameSubs.map(s => s.entityid as string));
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
        const subsForDomain = subs.filter(g => g.entityid === cur);
        const oldest = subsForDomain.sort((a,b) => a.last_update.getTime() - b.last_update.getTime())[0]
        prev[cur] = oldest.last_update;
        return prev;
        },
    {});
}