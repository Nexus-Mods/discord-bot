import { ClientExt } from "../types/DiscordTypes";
import { 
    DiscordAPIError, EmbedBuilder, Guild, Snowflake, TextChannel, 
    WebhookMessageCreateOptions, ShardClientUtil, DiscordjsError 
} from 'discord.js';
import { isTesting, Logger } from '../api/util';
import { CollectionStatus, IMod, IModFile, IModsFilter, IModsSort, ModFileCategory } from '../api/queries/v2';
import { 
    IModWithFiles, IPostableSubscriptionUpdate, ISubscribedItem, 
    SubscribedChannel, SubscribedItem, subscribedItemEmbed, SubscribedItemType, 
    SubscriptionCache, unavailableUpdate, unavailableUserUpdate, UserEmbedType 
} from '../types/subscriptions';
import { 
    deleteSubscribedChannel, deleteSubscription, ensureSubscriptionsDB, 
    getAllSubscriptions, getSubscribedChannel, getSubscribedChannels, 
    saveLastUpdatedForSub, setDateForAllSubsInChannel, updateSubscribedChannel, 
    updateSubscription 
} from '../api/subscriptions';
import { v2 as API } from '../api/queries/all';
import { baseheader } from "../api/util";


export class SubscriptionManger {
    private static instance: SubscriptionManger;
    private client: ClientExt;
    private updateTimer?: NodeJS.Timeout;
    private pollTime: number = 0;
    private channels: SubscribedChannel[];
    private channelGuildSet: Set<string>;
    private cache: SubscriptionCache = new SubscriptionCache();
    private logger: Logger;
    private batchSize: number = 10;
    public maxSubsPerGuild = 5;
    public paused: boolean = false;

    private NexusModsAPI = {
        v2: {
            Mods: (filter: IModsFilter, sort: IModsSort) => API.mods(baseheader, this.logger, filter, sort),
            ModFiles: (gameId: number, modId: number) => API.modFiles(baseheader, this.logger, gameId, modId),
            ModsByUid: (uids: string[]) => API.modsByUid(baseheader, this.logger, uids),
            Collection: (slug: string, gameDomain: string, includeDeleted: boolean) => API.collection(baseheader, this.logger, slug, gameDomain, includeDeleted),
            CollectionRevisions: (gameDomain: string, slug: string) => API.collectionRevisions(baseheader, this.logger, slug, gameDomain),
            FindUser: (username: number) => API.findUser(baseheader, this.logger, username),
        }
    }

    private constructor(client: ClientExt, pollTime: number, channels: SubscribedChannel[], logger: Logger) {
        this.logger = logger;
        this.channels = channels;
        this.channelGuildSet = new Set(channels.map(c => c.guild_id)); 
        // Save the client for later
        this.client = client;
        if (client.shard && client.shard.ids[0] !== 0) {
            // Return here if we're not on the main shard. 
            logger.info('Subscription Manager initialised', { channels: this.channels.length, pollTime: this.pollTime});
            return this;
        }       
        this.pollTime = pollTime;
        this.updateTimer = setInterval(async () => {
            try {
                await this.updateSubscriptions(true);
            }
            catch(err){
                this.logger.error('Failed to run subscription event', err);
            }
        }, pollTime)
        // Trigger an update 1 minute after booting up. This lets the other shards spin up.
        setTimeout(() => this.updateSubscriptions(), 90000);
        logger.info('Subscription Manager initialised', { channels: this.channels.length, pollTime: this.pollTime});
    }

    static async getInstance(client: ClientExt, logger: Logger, pollTime: number = (1000*60*10)): Promise<SubscriptionManger> {
        if (isTesting) pollTime = 30000;
        if (!SubscriptionManger.instance) {
            await SubscriptionManger.initialiseInstance(client, pollTime, logger);
            const guilds = client.guilds.cache;
            if (client.shard) logger.info('Subscription Manager has guilds', { count: guilds.size });
        }
        return SubscriptionManger.instance;
    }

    private static async initialiseInstance(client: ClientExt, pollTime: number, logger: Logger): Promise<void> {
        // Set up any missing tables
        try {
            if (!client.shard || client.shard?.ids[0] === 0) {
                // Only hit the database if we're either not running sharded or we're on shard 0;
                await ensureSubscriptionsDB();
                
            }
            let channels: SubscribedChannel[] = await getSubscribedChannels();
            if (client.shard) {
                // If we're sharded, we'll filter out the channels we can't manage.
                const shardId = client.shard.ids[0];
                channels = channels.filter(c => c.shardId(client) === shardId);
            }            
            SubscriptionManger.instance = new SubscriptionManger(client, pollTime, channels, logger);
        }
        catch(err) {
            throw err;
        }
    }

    public pause() {
        if (this.updateTimer) clearInterval(this.updateTimer);
        this.paused = true;
        this.updateTimer = undefined;
        this.logger.info('Subscription Manager paused');
    }

    public resume() {
        if (this.updateTimer) clearInterval(this.updateTimer);
        this.paused = false;
        this.updateTimer = setInterval(async () => {
            try {
                await this.updateSubscriptions();
            }
            catch(err){
                this.logger.error('Failed to run subscription event', err);
            }
        }, this.pollTime)
        this.logger.info('Subscription Manager resumed');
    }

    private async updateChannels() {
        const allChannels = await getSubscribedChannels();
        if (this.client.shard) {
            // Only add channels for my current shard!
            const shardId = this.client.shard.ids[0];
            const shardChannels = allChannels.filter(c => c.shardId(this.client) === shardId);
            this.logger.debug('Shard channels', { shardId, channels: shardChannels.length });
            return;
        }
        else this.channels = allChannels;
    }

    public removeChannel(id: number) {
        const channel = this.channels.find(c => c.id === id);
        if (!channel) return this.logger.warn('Attempted to remove channel but it was not found.', id);
        this.channels.splice(this.channels.indexOf(channel), 1);
        this.logger.info('Removed channel from SubscriptionManager', id);
        const remaining = this.channels.filter(c => c.guild_id === channel.guild_id).length;
        if (!remaining) this.channelGuildSet.delete(channel.guild_id);
    }

    public updateChannel(channel: SubscribedChannel) {
        const saved = this.channels.findIndex(c => c.id === channel.id);
        if (saved !== -1) this.channels[saved] = channel;
        else this.channels.push(channel);
    }

    private async updateSubscriptions(reloadChannels: boolean = false) {
        // Update the channels
        if (!reloadChannels) await this.updateChannels();
        // Prepare the cache
        await this.prepareCache();

        this.logger.info(`Running subscription updates for ${this.channels.length} channels in batches of ${this.batchSize}`);
        this.logger.debug('Guilds available to this shard', this.client.guilds.cache.size);
        
        // Process the channels and their subscribed items in batches.
        for (let i=0; i < this.channels.length; i += this.batchSize) {
            const batch = this.channels.slice(i, i + this.batchSize);
            this.logger.debug('Batched channels', batch.map(c => c.id));

            // Process a batch in parallel
            await Promise.allSettled(
                batch.map(async (channel) => {
                    if (this.paused === true) return;
                    try {
                        this.logger.debug('Processing channel', { channelId: channel.id, guildId: channel.guild_id });
                        await this.getUpdatesForChannel(channel);
                    }
                    catch(err) {
                        if ((err as DiscordjsError).message === 'Shards are still being spawned.') {
                            this.logger.warn('Shards are not ready to process updates');
                            return;
                        }
                        this.logger.warn('Error processing updates for channel: '+(err as Error).message, err);
                        return;
                    }

                })
            )

            this.logger.debug('Batch done', batch.map(c => c.id));
        }

        this.logger.info('Subscription updates complete');    
        // Reset the cache
        this.cache = new SubscriptionCache();
        // Trigger the update on other shards
        if (this.client.shard && this.client.shard.ids[0] === 0) {
            try {
                await this.client.shard.broadcastEval((client: ClientExt, context) => {
                    if (client.shard?.ids[0] !== context.mainId) client.subscriptions?.updateSubscriptions(true);
                }, { context: { mainId: this.client.shard.ids[0] } })
            }
            catch(err) {
                if ((err as DiscordjsError).message === 'Shards are still being spawned.') {
                    this.logger.warn('Shards are not ready to process updates');
                }
                else this.logger.error('Error sending update to other shards!', err);
            }
        }
    }


    public async forceChannnelUpdate(channel: SubscribedChannel, date: Date) {
        try {
            await setDateForAllSubsInChannel(date, channel.guild_id, channel.channel_id);
            if (!this.client.shard) return this.getUpdatesForChannel(channel, true);
            else {
                const shardForGuild = ShardClientUtil.shardIdForGuildId(channel.guild_id, this.client.shard.count);
                this.logger.info('Force update sending for Shard', shardForGuild);
                if (shardForGuild === this.client.shard.ids[0]) return this.getUpdatesForChannel(channel, true);
                this.logger.info('Sending forceChannelUpdate', { target: shardForGuild });
                const res = await this.client.shard.broadcastEval(async (client: ClientExt, context) => {
                    if (client.shard?.ids[0] === context.shardId) {
                        await client.subscriptions?.handleForceUpdate(context);
                        return 'Success';
                    }
                    else return null;
                }, { 
                    context: { 
                        type: 'forceChannelUpdate',
                        id: channel.id,
                        guild_id: channel.guild_id,
                        channel_id: channel.channel_id,
                        date: date.toISOString(),
                        shardId: shardForGuild 

                    } 
                });
                if (res.filter(r => r).length) return;
                else throw new Error('Unable to handle update');
            }
        }
        catch(err) {
            this.logger.warn('Failed to force updates', err);
            throw new Error('Unable to force-update all subs in channel.')
        }
    }

    public async handleForceUpdate(message: { type: string, date: string, id: number, guild_id: Snowflake, channel_id: Snowflake, shardId: number }) {
        this.logger.info('Recieved message', message);
        if (message.shardId !== this.client.shard!.ids[0]) return;
        if (message.type !== 'forceChannelUpdate') return;
        try {
            await setDateForAllSubsInChannel(new Date(message.date), message.guild_id, message.channel_id);
            const channel = this.channels.find(c => c.channel_id === c.channel_id) || await getSubscribedChannel(message.guild_id, message.channel_id);
            if (!channel) throw Error('Channel not found');
            return this.getUpdatesForChannel(channel);
        }
        catch(err) {
            this.logger.warn('Error forcing update of a channel', err);
        }
    }

    public async getUpdatesForChannel(channel: SubscribedChannel, skipCache = false) {
        // Verify the channel exists
        const guild = await this.client.guilds.fetch(channel.guild_id).catch(() => null);
        const discordChannel: TextChannel | null = guild ? await guild.channels.fetch(channel.channel_id).catch(() => null) as TextChannel : null;
        if (guild === null || discordChannel === null) {
            this.logger.warn('Discord channel not found to post subscriptions', { guild: guild?.name, guildId: channel.guild_id, channelId: channel.channel_id, subChannelId: channel.id });
            await deleteSubscribedChannel(channel);
            this.channels = this.channels.filter(c => c.id !== channel.id);
            return;
            // throw new Error('Discord channel no longer exists');
        }
        // Grab the WH Client
        const webHookClient = channel.webHookClient;
        // Grab the subscribed items
        const items = await channel.getSubscribedItems(skipCache);
        if (!items.length) {
            await deleteSubscribedChannel(channel);
            this.channels.splice(this.channels.findIndex(c => c.id === channel.id), 1);
            return;
        }
        // Get the postable info for each subscribed item
        const postableUpdates: IPostableSubscriptionUpdate<any>[] = [];
        for (const item of items) {
            let updates: IPostableSubscriptionUpdate<typeof item.type>[] = [];

            try {
                // Logic based on subscription type here.
                switch (item.type) {
                    case SubscribedItemType.Game: updates = await this.getGameUpdates(item as SubscribedItem<SubscribedItemType.Game>, guild);
                    break;
                    case SubscribedItemType.Mod:updates = await this.getModUpdates(item as SubscribedItem<SubscribedItemType.Mod>, guild);
                    break;
                    case SubscribedItemType.Collection: updates = await this.getCollectionUpdates(item as SubscribedItem<SubscribedItemType.Collection>, guild);
                    break;
                    case SubscribedItemType.User: updates = await this.getUserUpdates(item as SubscribedItem<SubscribedItemType.User>, guild);
                    break;
                    default: throw new Error('Unregcognised SubscribedItemType');
                }
                
                this.logger.debug(`Returning ${updates.length} updates for ${item.title} (${item.type}) since ${item.last_update.toISOString()}`);
            }
            catch(err) {
                this.logger.warn('Error updating subscription', { type: item.type, entity: item.entityid, config: item.config, error: err });
                continue;
            }           
            

            // Format the items into a generic type for comparison. 
            postableUpdates.push(...updates);
        }

        // Exit if there's nothing to post
        if (!postableUpdates.length) {
            this.logger.debug(`No updates for ${discordChannel.name} in ${guild.name}`);
            channel = await updateSubscribedChannel(channel, new Date());
            channel.last_update = new Date();
            return;
        }

        // Got all the updates - break them into groups by type and limit to 10 (API limit).
        const blocks: {message: WebhookMessageCreateOptions, crosspost: boolean}[] = [{ message: { embeds: [] }, crosspost: false }];   
        const maxBlockSize = 10;
        let currentType: SubscribedItemType = postableUpdates[0].type;
        let currentSub: number = postableUpdates[0].subId;
        for (const update of postableUpdates) {
            // If we've swapped type, sub or we've got more than 5 embeds already
            if (update.type !== currentType || update.subId != currentSub || blocks[blocks.length - 1].message.embeds!.length === maxBlockSize) blocks.push({ message: { embeds: [] }, crosspost: false});
            const myBlock = blocks[blocks.length - 1];
            myBlock.message.embeds = myBlock.message.embeds ? [...myBlock.message.embeds, update.embed] : [update.embed];
            if (!myBlock.message.content && update.message) myBlock.message.content = update.message;
            myBlock.crosspost = update.crosspost ?? false;
            currentType = update.type;
            currentSub = update.subId;
        }

        // Send the updates to the webhook!
        this.logger.info(`Posting ${postableUpdates.length} updates (Blocks:${blocks.length}) to ${discordChannel.name} in ${guild.name} (ID: ${channel.id})`);
        for (const block of blocks) {
            // logMessage('Sending Block\n', {titles: block.embeds?.map(e => (e as APIEmbed).title)}) // raw: JSON.stringify(block)
            try {
                const msg = await webHookClient.send(block.message);
                if (block.crosspost) {
                    const message = await discordChannel.messages.fetch(msg.id).catch(() => null);
                    if (message && message.crosspostable) {
                        try {
                            await message.crosspost();
                        }
                        catch(err) {
                            this.logger.warn('Failed to crosspost webhook message', { channel: discordChannel.name, guild: guild.name });
                            await webHookClient.send({ content: '-# Failed to crosspost the message. Please check the channel is an announcement channel and the bot has the `MANAGE_MESSAGE` permission.' }).catch(() => null);
                        }
                        this.logger.info('Webhook crossposted', { channel: discordChannel.name, guild: guild.name });
                    }
                    else {
                        this.logger.warn('Failed to crosspost webhook message', { channel: discordChannel.name, guild: guild.name });
                        await webHookClient.send({ content: '-# Failed to crosspost the message. Please check the channel is an announcement channel and the bot has the `MANAGE_MESSAGE` permission.' }).catch(() => null)
                    };
                }
            }
            catch(err) {
                if ((err as DiscordAPIError).message === 'Unknown Webhook') {
                    // The webhook has been deleted
                    await discordChannel.send('-# The webhook for this channel is no longer available. No futher updates will be posted. Please use `/track` to set up tracking again')
                    .catch(() => null);
                    // Delete the channel and all associated tracked items.
                    await deleteSubscribedChannel(channel);
                    this.channels = this.channels.filter(c => c.id !== channel.id);
                    this.channelGuildSet.delete(channel.guild_id);
                    throw Error('Webhook no longer exists');
                }
                this.logger.warn('Failed to send webhook message', { embeds: block.message.embeds?.length, err, body: JSON.stringify((err as any).requestBody.json) });
            }
        }

        // Update the last updated time for the channel.
        const lastUpdate = postableUpdates[postableUpdates.length - 1].date;
        try {
            channel = await updateSubscribedChannel(channel, lastUpdate);
            channel.last_update = lastUpdate;
        }
        catch(err) {
            this.logger.warn('Failed to update channel date', err);
        }
    }

    private async getGameUpdates<T extends SubscribedItemType.Game>(item: SubscribedItem<T>, guild: Guild): Promise<IPostableSubscriptionUpdate<T>[]> {
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Game>[] = [];
        const domain: string = item.entityid as string;
        const last_update = item.last_update;
        let newMods = item.config.show_new 
            ? (this.cache.games.new[domain] ?? []).filter(m => new Date(m.createdAt) > last_update && modCanShow(m, item) )
            : [];
        // If there's nothing in the cache, we'll double check
        if (!newMods.length && item.config.show_new) {
            this.logger.debug('Re-fetching new mods', { domain, itemId: item.id, parent: item.parent });
            const filters: IModsFilter = { 
                gameDomainName: { value: domain, op: 'EQUALS' },
                createdAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' },
            }
            // Hide SFW content
            if (item.config.sfw === false && item.config.nsfw === true) filters.adultContent = { value: true, op: 'EQUALS' };
            // Hide NSFW content
            if (item.config.nsfw === false && item.config.sfw === true) filters.adultContent = { value: false, op: 'EQUALS' };
            const res = await this.NexusModsAPI.v2.Mods(
                filters, 
                { createdAt: { direction: 'ASC' } }
            );
            newMods = res.nodes;
        }
        else if (item.config.show_new) this.logger.debug('Using cached new mods', { domain, count: newMods.length, itemId: item.id, parent: item.parent });
        // Map into the generic format.
        const formattedNew: IPostableSubscriptionUpdate<SubscribedItemType.Game>[] = [];
        for (const mod of newMods) {
            const embed = await subscribedItemEmbed<SubscribedItemType.Game>(this.logger, mod, item, guild);
            formattedNew.push({ 
                type: SubscribedItemType.Game, 
                date: new Date(mod.createdAt), 
                entity: mod, 
                subId: item.id,
                embed: embed.data,
                message: item.message ?? null,
                crosspost: item.crosspost ?? false,
            })
        }
        results.push(...formattedNew);

        let updatedMods: (IMod & { files?: IModFile[]})[] = item.config.show_updates 
            ? (this.cache.games.updated[domain] ?? []).filter(m => new Date(m.updatedAt) > last_update && modCanShow(m, item) )
            : [];
        // If there's nothing in the cache, we'll double check
        if (!updatedMods.length && item.config.show_updates) {
            this.logger.debug('Re-fetching updated mods', { domain, itemId: item.id, parent: item.parent });
            const filters: IModsFilter = { 
                gameDomainName: { value: domain, op: 'EQUALS' },
                updatedAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' },
                hasUpdated: { value: true, op: 'EQUALS' }
            }
            // Hide SFW content
            if (item.config.sfw === false && item.config.nsfw === true) filters.adultContent = { value: true, op: 'EQUALS' };
            // Hide NSFW content
            if (item.config.nsfw === false && item.config.sfw === true) filters.adultContent = { value: false, op: 'EQUALS' };
            const res = await this.NexusModsAPI.v2.Mods(
                filters, 
                { createdAt: { direction: 'ASC' } }
            );
            updatedMods = res.nodes;
            // Get the file lists (including changelogs)
        }
        else if (item.config.show_updates) this.logger.debug('Using cached updated mods', { domain, count: updatedMods.length, itemId: item.id, parent: item.parent });
        // Attach a list of files
        for (const mod of updatedMods) {
            const files = this.cache.getCachedModFiles(mod.uid) ?? await this.NexusModsAPI.v2.ModFiles(mod.game.id, mod.modId);
            mod.files = files;
            this.cache.add('modFiles', files, mod.uid);
        }
        // Map into the generic format.
        const formattedUpdates: IPostableSubscriptionUpdate<SubscribedItemType.Game>[] = [];
        for (const mod of updatedMods) {
            const embed = await subscribedItemEmbed<SubscribedItemType.Game>(this.logger, mod, item, guild, true);
            formattedUpdates.push({ 
                type: SubscribedItemType.Game, 
                date: new Date(mod.updatedAt), 
                entity: mod, 
                subId: item.id,
                embed: embed.data,
                message: item.message ?? null,
                crosspost: item.crosspost ?? false,
            })
        }
        results.push(...formattedUpdates);

        // Exit if there's nothing to post
        if (!results.length) {
            await saveLastUpdatedForSub(item.id, new Date());
            item.last_update = new Date();
            return results
        };
        // Order the array so the newest is first and the oldest is last
        results.sort((a,b) => a.date.getTime() - b.date.getTime())
        // Save the last date so we know where to start next time!
        const lastDate = results[results.length -1].date;
        await saveLastUpdatedForSub(item.id, lastDate);
        item.last_update = lastDate;
        // Return the results
        return results;
    }

    private async getModUpdates<T extends SubscribedItemType.Mod>(item: SubscribedItem<T>, guild: Guild): Promise<IPostableSubscriptionUpdate<T>[]> {
        // logMessage('Processing mod updates', item.title);
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Mod>[] = [];
        const modUid: string = item.entityid as string;
        // const ids = modUidToGameAndModId(modUid); // We can convert the UID to mod/game IDs, but we need to domain to look it up on the API.
        const last_update = item.last_update;
        const res = await this.NexusModsAPI.v2.ModsByUid([modUid]);
        const mod: IModWithFiles = res[0];
        if (!mod) throw new Error(`Mod not found for ${modUid}`);
        if (['hidden', 'under_moderation'].includes(mod.status)) {
            this.logger.info('Mod is temporarily unavailable:', mod.status);
            if (item.config.last_status === 'published') {
                results.push(unavailableUpdate<SubscribedItemType.Mod>(mod, SubscribedItemType.Mod, item, mod.status))
                await saveLastUpdatedForSub(item.id, results[0].date, mod.status);
            }
            return results;
        }
        else if (['deleted', 'wastebinned'].includes(mod.status)){
            this.logger.info('Mod is permanently unavailable:', mod.status);
            if (item.config.last_status === 'published') {
                results.push(unavailableUpdate<SubscribedItemType.Mod>(mod, SubscribedItemType.Mod, item, mod.status))
                await deleteSubscription(item.id);
            }
            return results;
        } 
        mod.files = await this.NexusModsAPI.v2.ModFiles(mod.game.id, mod.modId) ?? [];
        // See which files are new.
        const newFiles = mod.files.filter(f => {
            const fileDate: Date = new Date(Math.floor(f.date * 1000));
            // File date is greater than last_update on this item.
            if (fileDate.getTime() <= last_update.getTime()) return false;
            // Not archived or deleted
            return ![ModFileCategory.Archived, ModFileCategory.Removed].includes(f.category)
        })
        .slice(0,5); // Max of 5 due to embed limits
        // logMessage('New files found', newFiles.length);
        if (!newFiles.length) return results;
        // Map the newly uploaded files
        for (const file of newFiles) {
            const embed = await subscribedItemEmbed<SubscribedItemType.Mod>(this.logger, {...mod, files: [file]}, item, guild);
            results.push({
                type: SubscribedItemType.Mod, 
                date: new Date(file.date * 1000), 
                entity: {...mod, files: [file]}, 
                subId: item.id,
                embed: embed.data,
                message: item.message ?? null,
                crosspost: item.crosspost ?? false,
            });
        }
        // Order the array so the newest is first and the oldest is last
        results.sort((a,b) => a.date.getTime() - b.date.getTime());
        // Save the last date so we know where to start next time!
        const lastDate = results[results.length -1].date;
        await saveLastUpdatedForSub(item.id, lastDate, mod.status);    
        item.last_update = lastDate;
        
        return results;
    } 

    private async getCollectionUpdates<T extends SubscribedItemType.Collection>(item: SubscribedItem<T>, guild: Guild): Promise<IPostableSubscriptionUpdate<T>[]> {
        // logMessage('Processing collection updates', item.title);
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Collection>[] = [];
        const {gameDomain, slug} = item.collectionIds!;
        const last_update = item.last_update;
        const collection = await this.NexusModsAPI.v2.Collection(slug, gameDomain, true);
        if (!collection) throw new Error(`Collection not found for ${item.entityid}`);
        if (collection.collectionStatus === CollectionStatus.Moderated) {
            this.logger.info('Collection under moderation', item.title);
            if ([CollectionStatus.Listed, CollectionStatus.Unlisted].includes(item.config.last_status as CollectionStatus)) {
                results.push(unavailableUpdate<SubscribedItemType.Collection>(collection, SubscribedItemType.Collection, item, collection.collectionStatus))
                await saveLastUpdatedForSub(item.id, results[0].date, collection.collectionStatus);
            }
            return results;
        }
        else if (collection.collectionStatus === CollectionStatus.Discarded) {
            this.logger.info('Collection has been discarded', item.title);
            if ([CollectionStatus.Listed, CollectionStatus.Unlisted].includes(item.config.last_status as CollectionStatus)) {
                results.push(unavailableUpdate<SubscribedItemType.Collection>(collection, SubscribedItemType.Collection, item, collection.collectionStatus))
                await deleteSubscription(item.id);
            }
            return results;
        }
        const collectionUpdatedAt = new Date(collection.latestPublishedRevision.updatedAt);
        if (collectionUpdatedAt.getTime() < last_update.getTime()) {
            // Collection hasn't been updated since we last checked.
            // logMessage('No updates found', item.title);
            return results;
        }
        const withRevisions = await this.NexusModsAPI.v2.CollectionRevisions(gameDomain, slug);
        if (!withRevisions) throw new Error(`Unable to get revision data`);
        const revisions = withRevisions.revisions.filter(r => new Date(r.updatedAt).getTime() > last_update.getTime())
            .sort((a,b) => a.revisionNumber - b.revisionNumber)
            .slice(0, 5); // Limit to 5 collections as the embeds can be a lot bigger.
        if (!revisions.length) return results;
        // Map into updates
        for(const rev of revisions) {
            const merged = { ...collection, revisions: [rev] }
            const embed = await subscribedItemEmbed<SubscribedItemType.Collection>(this.logger, merged, item, guild);
            results.push({
                type: SubscribedItemType.Collection,
                entity: merged,
                subId: item.id,
                date: new Date(rev.updatedAt),
                message: item.message,
                embed: embed.data,
                crosspost: item.crosspost ?? false,
            })
        }

        // Order the array so the newest is first and the oldest is last
        results.sort((a,b) => a.date.getTime() - b.date.getTime());
        // Save the last date so we know where to start next time!
        const lastDate = results[results.length -1].date;
        await saveLastUpdatedForSub(item.id, lastDate, collection.collectionStatus);
        item.last_update = lastDate;
                
        return results;
    } 

    private async getUserUpdates<T extends SubscribedItemType.User>(item: SubscribedItem<T>, guild: Guild): Promise<IPostableSubscriptionUpdate<T>[]> {
        // logMessage('Processing user updates', item.title);
        const results: IPostableSubscriptionUpdate<SubscribedItemType.User>[] = [];
        const userId: number = item.entityid as number;
        const last_update = item.last_update;
        const user = await this.NexusModsAPI.v2.FindUser(userId);
        if (!user) throw new Error(`User not found for ${userId}`);
        if (user.banned === true || user.deleted == true) {
            this.logger.info(`${user.name} has been banned or deleted from Nexus Mods`);
            results.push(unavailableUserUpdate(user, item));
            await deleteSubscription(item.id);
        }
        if (user.name !== item.title) {
            this.logger.info(`${item.title} changed their username to ${user.name}`);
            const usernameEmbed = new EmbedBuilder().setTitle('Username changed!')
            .setDescription(`${item.title} changed their username to ${user.name}`)
            .setColor('Random');
            results.push({
                type: SubscribedItemType.User,
                entity: user,
                date: new Date(),
                subId: item.id,
                embed: usernameEmbed.data,
                crosspost: item.crosspost ?? false,
            })
            await updateSubscription(item.id, item.parent, {...item, title: user.name});
            item.title = user.name;
        }
        // See if they have any new content since the last check
        const newMods = await this.NexusModsAPI.v2.Mods(
            {
                uploaderId: { value: userId.toString(), op: 'EQUALS' },
                createdAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' },
            },
            { createdAt: { direction: 'ASC' } }
        );
        for (const mod of newMods.nodes) {
            const embed = await subscribedItemEmbed<SubscribedItemType.User>(this.logger, {...user, mod: mod}, item, guild, undefined, UserEmbedType.NewMod);
            results.push({
                type: SubscribedItemType.User,
                entity:{ ...user, mod: mod },
                date: new Date(mod.createdAt),
                subId: item.id,
                embed: embed.data,
                crosspost: item.crosspost ?? false,
            });
        }
        const updatedMods = await this.NexusModsAPI.v2.Mods(
            {
                uploaderId: { value: userId.toString(), op: 'EQUALS' },
                updatedAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' },
                hasUpdated: { value: true, op: 'EQUALS' }
            },
            { updatedAt: { direction: 'ASC' } }
        );
        for (const mod of updatedMods.nodes) {
            const modFiles: IModFile[] = await this.NexusModsAPI.v2.ModFiles(mod.game.id, mod.modId);
            const modWithFile = { ...mod, file: modFiles.filter(f => Math.floor(f.date *1000) > last_update.getTime()) }
            const embed = await subscribedItemEmbed<SubscribedItemType.User>(this.logger, {...user, mod: modWithFile}, item, guild, undefined, UserEmbedType.UpdatedMod);
            results.push({
                type: SubscribedItemType.User,
                entity:{ ...user, mod: mod },
                date: new Date(mod.updatedAt),
                subId: item.id,
                embed: embed.data,
                crosspost: item.crosspost ?? false,
            });
        }
        // // COLLECTIONS FILTERING BY DATE IS BROKEN ON THE V2 API 
        // const newCollections = await this.NexusModsAPI.v2.Collections(
        //     {
        //         userId: { value: userId.toString(), op: 'EQUALS' },
        //         createdAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' }
        //     },
        //     { createdAt: { direction: 'ASC' } }
        // );
        // for (const collection of newCollections.nodes) {
        //     const embed = await subscribedItemEmbed({...user, collection: collection}, item, guild, undefined, UserEmbedType.NewCollection);
        //     results.push({
        //         type: SubscribedItemType.User,
        //         entity:{ ...user, collection: collection },
        //         date: new Date(collection.firstPublishedAt),
        //         subId: item.id,
        //         embed: embed.data
        //     });
        // }       
        // const updatedCollections = await this.NexusModsAPI.v2.Collections(
        //     {
        //         userId: { value: userId.toString(), op: 'EQUALS' },
        //         updatedAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' }
        //     },
        //     { updatedAt: { direction: 'ASC' } }
        // );
        // for (const collection of updatedCollections.nodes) {
        //     const embed = await subscribedItemEmbed({...user, collection: collection}, item, guild, undefined, UserEmbedType.UpdatedCollection);
        //     results.push({
        //         type: SubscribedItemType.User,
        //         entity:{ ...user, collection: collection },
        //         date: new Date(collection.updatedAt),
        //         subId: item.id,
        //         embed: embed.data
        //     });
        // }
        // // END COLLECTIONS SECTION
        // We could also check for media? But not right now.

        if (!results.length) return results;

        // Order the array so the newest is first and the oldest is last
        results.sort((a,b) => a.date.getTime() - b.date.getTime());
        // Save the last date so we know where to start next time!
        const lastDate = results[results.length -1].date;
        // logMessage('Last date', { title: item.title, lastDate, last_update, result: results[results.length -1].embed.author?.name })
        await saveLastUpdatedForSub(item.id, lastDate);
        item.last_update = lastDate;

        return results;
    } 

    private async prepareCache() {
        let subs = await getAllSubscriptions();
        if (this.client.shard) {
            // We're only managing some of the subs, so we don't need to cache everything;
            const shardChannelIds = this.channels.map(c => (typeof(c.id) === 'number') ? c.id: parseInt(c.id));
            subs = subs.filter(s => shardChannelIds.includes(s.parent));
        }
        this.logger.debug('Preparing cache for subscriptions', { subs: subs.length, channels: this.channels.length });

        const promises: Promise<void>[] = [];

        const allGameSubs: SubscribedItem<SubscribedItemType.Game>[] = subs.filter(
            (s): s is SubscribedItem<SubscribedItemType.Game> => s.type === SubscribedItemType.Game
        );

        // NEW MODS FOR GAMES 
        const newGameSubs = allGameSubs.filter(s => s.config?.show_new ?? false);
        const newGames = new Set<string>(newGameSubs.map(s => s.entityid as string));
        // For each game, get the date of the oldest possible mod to show.
        const oldestPerNewGame = getMaxiumDatesForGame(newGameSubs, newGames);
        const newGamePromises = Object.entries(oldestPerNewGame).map(async ([ domain, date ]) => {
            const mods = await this.NexusModsAPI.v2.Mods(
                {
                    gameDomainName: { value: domain, op: 'EQUALS' },
                    createdAt: { value: Math.floor(date.getTime()/1000).toString(), op: 'GT' }
                },
                { createdAt: { direction: 'ASC' } }
            );
            this.cache.add('games', mods.nodes, domain);
            if (isTesting || mods.totalCount > 0) this.logger.debug(`Pre-cached ${mods.nodes.length}/${mods.totalCount} new mods for ${domain} since ${date}`)
        });
        promises.push(...newGamePromises);

        // UPDATED MODS FOR GAMES
        const updatedGameSubs = allGameSubs.filter(s => s.config?.show_updates ?? false);
        const updatedGames = new Set<string>(updatedGameSubs.map(s => s.entityid as string));
        const oldestPerUpdatedGame = getMaxiumDatesForGame(updatedGameSubs, updatedGames);
        const updatedGamePromises = Object.entries(oldestPerUpdatedGame).map(async ([ domain, date ]) => {
            const mods = await this.NexusModsAPI.v2.Mods(
                {
                    gameDomainName: { value: domain, op: 'EQUALS' },
                    updatedAt: { value: Math.floor(date.getTime()/1000).toString(), op: 'GT' },
                    hasUpdated: { value: true, op:'EQUALS' }
                },
                { updatedAt: { direction: 'ASC' } }
            );
            this.cache.add('games', mods.nodes, domain, true);
            if (isTesting || mods.totalCount > 0) this.logger.debug(`Pre-cached ${mods.nodes.length}/${mods.totalCount} updated mods for ${domain} since ${date}`)
        });
        promises.push(...updatedGamePromises);

        // TODO - We could cache the values of common mods, users and collections here, but it's an improvement.

        // Let all the promises resolve
        return await Promise.allSettled(promises);
    }
}

function getMaxiumDatesForGame(subs: ISubscribedItem<SubscribedItemType.Game>[], games: Set<string>) {
    return [...games].reduce<{ [domain: string]: Date }>(
        (prev, cur) => {
        const subsForDomain = subs.filter(g => g.entityid === cur);
        const oldest = subsForDomain.sort((a,b) => a.last_update.getTime() - b.last_update.getTime());
        prev[cur] = oldest[0].last_update;
        return prev;
        },
    {});
}

function modCanShow(mod: IMod, item: SubscribedItem<SubscribedItemType.Game>) {
    if (item.config.nsfw === false && mod.adult === true) return false;
    if (item.config.sfw === false && mod.adult === false) return false;
    return true;
}