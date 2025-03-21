import { ClientExt } from "../types/DiscordTypes";
import { APIEmbed, EmbedBuilder, embedLength, Guild, JSONEncodable, TextChannel,  WebhookMessageCreateOptions } from 'discord.js';
import { logMessage } from '../api/util';
import { DiscordBotUser, DummyNexusModsUser } from '../api/DiscordBotUser';
import { IMod, IModFile, ModFileCategory } from '../api/queries/v2';
import { IModWithFiles, IPostableSubscriptionUpdate, ISubscribedItem, SubscribedChannel, SubscribedItem, subscribedItemEmbed, SubscribedItemType, SubscriptionCache } from '../types/subscriptions';
import { ensureSubscriptionsDB, getAllSubscriptions, getSubscribedChannels, saveLastUpdatedForSub, updateSubscribedChannel } from '../api/subscriptions';

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

    static async getInstance(client: ClientExt, pollTime: number = (1000*60*5)): Promise<SubscriptionManger> {
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

        logMessage('Running subscription updates');

        // Process the channels and their subscribed items.
        for (const channel of this.channels) {
            try {
                await this.getUpdatesForChannel(channel);
            }
            catch(err) {
                logMessage('Error processing updates for channel', err, true);
                continue;
            }
        }

        // Empty the cache
        this.cache = new SubscriptionCache();    
        logMessage('Subscription updates complete');    
    }

    public async getUpdatesForChannel(channel: SubscribedChannel) {
        // Verify the channel exists
        const guild = await this.client.guilds.fetch(channel.guild_id)
        const discordChannel: TextChannel | null = await guild.channels.fetch(channel.channel_id) as TextChannel;
        if (!guild || !discordChannel) {
            logMessage('Discord channel not found to post subscriptions', { guild: guild?.name, channelId: channel.channel_id });
            return;
        }
        else logMessage(`Processing subscribed items for ${discordChannel.name} in ${guild.name}`)
        // Grab the WH Client
        const webHookClient = channel.webHookClient;
        // Grab the subscribed items
        const items = await channel.getSubscribedItems();
        if (!items.length) return;
        // Get the postable info for each subscribed item
        const postableUpdates: IPostableSubscriptionUpdate<any>[] = [];
        for (const item of items) {
            let updates: IPostableSubscriptionUpdate<typeof item.type>[] = [];

            try {
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
                    default: throw new Error('Unregcognised SubscribedItemType');
                }
                logMessage(`Returning ${updates.length} updates for ${item.title} (${item.type})`);
            }
            catch(err) {
                logMessage('Error updating subscription', { type: item.type, entity: item.entityid, error: err });
                continue;
            }           
            

            // Format the items into a generic type for comparison. 
            postableUpdates.push(...updates);
        }

        // TODO! Update the last_update for the channel

        // Exit if there's nothing to post
        if (!postableUpdates.length) {
            logMessage(`No updates for ${discordChannel.name} in ${guild.name}`);
            return;
        }

        // Got all the updates - break them into groups by type and limit to 10 (API limit).
        const blocks: WebhookMessageCreateOptions[] = [{ embeds: [] }];
        const maxBlockSize = 5;
        let currentType: SubscribedItemType = postableUpdates[0].type;
        let currentSub: number = postableUpdates[0].subId;
        for (const update of postableUpdates) {
            // If we've swapped type, sub or we've got more than 5 embeds already
            if (update.type !== currentType || update.subId != currentSub || blocks[blocks.length - 1].embeds!.length === maxBlockSize) blocks.push({ embeds: [] })
            const myBlock = blocks[blocks.length - 1];
            myBlock.embeds = myBlock.embeds ? [...myBlock.embeds, update.embed] : [update.embed];
            if (!myBlock.content && update.message) myBlock.content = update.message;
            currentType = update.type;
            currentSub = update.subId;
        }

        // Send the updates to the webhook!
        logMessage(`Posting ${blocks.length} webhook updates to ${discordChannel.name} in ${guild.name}`);
        for (const block of blocks) {
            logMessage('Sending Block\n', {titles: block.embeds?.map(e => (e as APIEmbed).title)}) // raw: JSON.stringify(block)
            try {
                await webHookClient.send(block);
            }
            catch(err) {
                logMessage('Failed to send webhook message', { embeds: block.embeds?.length, err, body: (err as any).requestBody.json }, true); 
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
                    createdAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' }
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
                subId: item.id,
                embed: embed.data,
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
                    updatedAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' },
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
                subId: item.id,
                embed: embed.data,
                message: item.message ?? null
            })
        }
        results.push(...formattedUpdates);

        // Exit if there's nothing to post
        if (!results.length) return results;
        // Order the array so the newest is first and the oldest is last
        results.sort((a,b) => a.date.getTime() - b.date.getTime())
        // Save the last date so we know where to start next time!
        const lastDate = results[results.length -1].date;
        await saveLastUpdatedForSub(item.id, lastDate);
        // Return the results
        return results;
    }

    private async getModUpdates(item: SubscribedItem, guild: Guild): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Mod>[]> {
        logMessage('Processing mod updates', item.title);
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Mod>[] = [];
        const modUid: string = item.entityid as string;
        const last_update = item.last_update;
        const res = await this.fakeUser.NexusMods.API.v2.ModsByUid([modUid]);
        const mod: IModWithFiles = res[0];
        if (!mod) throw new Error(`Mod not found for ${modUid}`);
        mod.files = await this.fakeUser.NexusMods.API.v2.ModFiles(mod.game.id, mod.modId) ?? [];
        // See which files are new.
        const newFiles = mod.files.filter(f => {
            const fileDate: Date = new Date(Math.floor(f.date * 1000));
            // File date is greater than last_update on this item.
            if (fileDate.getTime() <= last_update.getTime()) return false;
            // Not archived or deleted
            return ![ModFileCategory.Archived, ModFileCategory.Removed].includes(f.category)
        });
        logMessage('New files found', newFiles.length);
        if (!newFiles.length) return results;
        // Map the newly uploaded files
        for (const file of newFiles) {
            const embed = await subscribedItemEmbed({...mod, files: [file]}, item, guild);
            results.push({
                type: SubscribedItemType.Mod, 
                date: new Date(file.date * 1000), 
                entity: {...mod, files: [file]}, 
                subId: item.id,
                embed: embed.data,
                message: item.message ?? null
            });
        }
        // Order the array so the newest is first and the oldest is last
        results.sort((a,b) => a.date.getTime() - b.date.getTime());
        // Save the last date so we know where to start next time!
        const lastDate = results[results.length -1].date;
        await saveLastUpdatedForSub(item.id, lastDate);    
        
        return results;
    } 

    private async getCollectionUpdates(item: SubscribedItem, guild: Guild): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Collection>[]> {
        logMessage('Processing collection updates', item.title);
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Collection>[] = [];
        const [gameDomain, slug] = (item.entityid as string).split(':');
        const last_update = item.last_update;
        const collection = await this.fakeUser.NexusMods.API.v2.Collection(slug, gameDomain, true);
        if (!collection) throw new Error(`Collection not found for ${item.entityid}`);
        const collectionUpdatedAt = new Date(collection.latestPublishedRevision.updatedAt);
        if (collectionUpdatedAt.getTime() <= last_update.getTime()) {
            // Collection hasn't been updated since we last checked.
            return results;
        }
        const withRevisions = await this.fakeUser.NexusMods.API.v2.CollectionRevisions(gameDomain, slug);
        if (!withRevisions) throw new Error(`Unable to get revision data`);
        const revisions = withRevisions.revisions.filter(r => new Date(r.updatedAt).getTime() > last_update.getTime()).sort((a,b) => a.revisionNumber - b.revisionNumber);
        if (!revisions.length) return results;
        // Map into updates
        for(const rev of revisions) {
            const merged = { ...collection, revisions: [rev] }
            const embed = await subscribedItemEmbed(merged, item, guild);
            results.push({
                type: SubscribedItemType.Collection,
                entity: merged,
                subId: item.id,
                date: new Date(rev.updatedAt),
                message: item.message,
                embed: embed.data,
            })
        }

        // Order the array so the newest is first and the oldest is last
        results.sort((a,b) => a.date.getTime() - b.date.getTime());
        // Save the last date so we know where to start next time!
        const lastDate = results[results.length -1].date;
        await saveLastUpdatedForSub(item.id, lastDate);
                
        return results;
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
                    createdAt: { value: Math.floor(date.getTime()/1000).toString(), op: 'GT' }
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
                    updatedAt: { value: Math.floor(date.getTime()/1000).toString(), op: 'GT' },
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