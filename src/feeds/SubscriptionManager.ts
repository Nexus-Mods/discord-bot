import { ClientExt } from "../types/DiscordTypes";
import { DiscordAPIError, EmbedBuilder, Guild, Snowflake, TextChannel,  WebhookMessageCreateOptions, ShardClientUtil, DiscordjsError } from 'discord.js';
import { Logger } from '../api/util';
import { DiscordBotUser, DummyNexusModsUser } from '../api/DiscordBotUser';
import { CollectionStatus, IMod, IModFile, IModsFilter, ModFileCategory } from '../api/queries/v2';
import { IModWithFiles, IPostableSubscriptionUpdate, ISubscribedItem, SubscribedChannel, SubscribedItem, subscribedItemEmbed, SubscribedItemType, SubscriptionCache, unavailableUpdate, unavailableUserUpdate, UserEmbedType } from '../types/subscriptions';
import { deleteSubscribedChannel, deleteSubscription, ensureSubscriptionsDB, getAllSubscriptions, getSubscribedChannel, getSubscribedChannels, saveLastUpdatedForSub, updateSubscribedChannel, updateSubscription } from '../api/subscriptions';

export class SubscriptionManger {
    private static instance: SubscriptionManger;
    private client: ClientExt;
    private updateTimer?: NodeJS.Timeout;
    private pollTime: number = 0; //10 mins
    private channels: SubscribedChannel[];
    private cache: SubscriptionCache = new SubscriptionCache();
    private fakeUser: DiscordBotUser;
    private logger: Logger;

    private constructor(client: ClientExt, pollTime: number, channels: SubscribedChannel[], logger: Logger) {
        this.logger = logger;
        this.channels = channels;
        this.fakeUser = new DiscordBotUser(DummyNexusModsUser, logger);
        // Save the client for later
        this.client = client;
        if (client.shard && client.shard.ids[0] !== 0) {
            this.channels=[];
            this.logger.info('Subscriptions only run on the first shard.'); // Only run on the first shard
            return this;
        }        
        this.pollTime = pollTime;
        this.updateTimer = setInterval(async () => {
            try {
                await this.updateSubscriptions();
            }
            catch(err){
                this.logger.error('Failed to run subscription event', err);
            }
        }, pollTime)
        // Kick off an update.
        this.updateSubscriptions(true);
    }

    static async getInstance(client: ClientExt, logger: Logger, pollTime: number = (1000*60*10)): Promise<SubscriptionManger> {
        if (!SubscriptionManger.instance) {
            await SubscriptionManger.initialiseInstance(client, pollTime, logger);
            const guilds = client.guilds.cache;
            if (client.shard) logger.info('Subscription Manager has guilds', { count: guilds.size });
        }
        logger.info('Subscription Manager initialised', { channels: SubscriptionManger.instance.channels.length, pollTime});
        return SubscriptionManger.instance;
    }

    private static async initialiseInstance(client: ClientExt, pollTime: number, logger: Logger): Promise<void> {
        // Set up any missing tables
        try {
            await ensureSubscriptionsDB();
            const channels = await getSubscribedChannels();
            SubscriptionManger.instance = new SubscriptionManger(client, pollTime, channels, logger);
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

        this.logger.info(`Running subscription updates for ${this.channels.length} channels`);

        // Process the channels and their subscribed items.
        for (const channel of this.channels) {
            try {
                this.logger.debug('Processing channel', { channelId: channel.id, guildId: channel.guild_id });
                if (this.client.shard) {
                    if (!this.client.guilds.cache.get(channel.guild_id)) {
                        // This shard doesn't have the guild.
                        this.logger.info('This shard does not have the guild', { guild: channel.guild_id, channelId: channel.channel_id });
                        const shards = await this.client.shard.broadcastEval(async (client: ClientExt, context: { guildId: Snowflake, channelId: Snowflake }) => {
                            if (client.guilds.cache.has(context.guildId)) {
                                const channel = await getSubscribedChannel(context.guildId, context.channelId);
                                if (channel) await client.subscriptions?.getUpdatesForChannel(channel);
                                return true;
                            }
                            else return false;
                        }, { context: { guildId: channel.guild_id, channelId: channel.channel_id } });
                        if (!shards.includes(true)) {
                            this.logger.info('Shard not found for channel', { guild: channel.guild_id, channelId: channel.channel_id });
                            continue;
                        }
                    }
                    else this.logger.debug('This shard has the guild', { guild: channel.guild_id, channelId: channel.channel_id });
                }
                await this.getUpdatesForChannel(channel);
            }
            catch(err) {
                if ((err as DiscordjsError).message === 'Shards are still being spawned.') {
                    this.logger.warn('Shards are not ready to process updates');
                    continue;
                }
                this.logger.warn('Error processing updates for channel: '+(err as Error).message, err);
                continue;
            }
        }

        // Empty the cache
        this.cache = new SubscriptionCache();    
        this.logger.info('Subscription updates complete');    
    }

    public async getUpdatesForChannel(channel: SubscribedChannel) {
        // Verify the channel exists
        const guild = await this.client.guilds.fetch(channel.guild_id).catch(() => null);
        const discordChannel: TextChannel | null = guild ? await guild.channels.fetch(channel.channel_id).catch(() => null) as TextChannel : null;
        if (guild === null || discordChannel === null) {
            this.logger.warn('Discord channel not found to post subscriptions', { guild: guild?.name, channelId: channel.channel_id, subChannelId: channel.id });
            await deleteSubscribedChannel(channel);
            throw new Error('Discord channel no longer exists')
            return;
        }
        // Grab the WH Client
        const webHookClient = channel.webHookClient;
        // Grab the subscribed items
        const items = await channel.getSubscribedItems();
        if (!items.length) return;
        // logMessage(`Processing ${items.length} subscribed items for ${discordChannel.name} in ${guild.name}`)
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
                // logMessage(`Returning ${updates.length} updates for ${item.title} (${item.type})`);
            }
            catch(err) {
                this.logger.warn('Error updating subscription', { type: item.type, entity: item.entityid, error: err });
                continue;
            }           
            

            // Format the items into a generic type for comparison. 
            postableUpdates.push(...updates);
        }

        // TODO! Update the last_update for the channel

        // Exit if there's nothing to post
        if (!postableUpdates.length) {
            // logMessage(`No updates for ${discordChannel.name} in ${guild.name}`);
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
        this.logger.info(`Posting ${blocks.length} webhook updates to ${discordChannel.name} in ${guild.name}`);
        for (const block of blocks) {
            // logMessage('Sending Block\n', {titles: block.embeds?.map(e => (e as APIEmbed).title)}) // raw: JSON.stringify(block)
            try {
                const msg = await webHookClient.send(block.message);
                if (block.crosspost) {
                    const message = await discordChannel.messages.fetch(msg.id).catch(() => null);
                    if (message && message.crosspostable) {
                        await message.crosspost();
                        this.logger.info('Webhook crossposted', { channel: discordChannel.name, guild: guild.name });
                    }
                    else this.logger.warn('Failed to crosspost webhook message', { channel: discordChannel.name, guild: guild.name });
                }
            }
            catch(err) {
                if ((err as DiscordAPIError).message === 'Unknown Webhook') {
                    // The webhook has been deleted
                    await discordChannel.send('-# The webhook for this channel is no longer available. No futher updates will be posted. Please use `/track` to set up tracking again')
                    .catch(() => null);
                    // Delete the channel and all associated tracked items.
                    await deleteSubscribedChannel(channel);
                    throw Error('Webhook no longer exists');
                }
                this.logger.warn('Failed to send webhook message', { embeds: block.message.embeds?.length, err, body: JSON.stringify((err as any).requestBody.json) });
            }
        }

        // Update the last updated time for the channel.
        const lastUpdate = postableUpdates[postableUpdates.length - 1].date;
        try {
            await updateSubscribedChannel(channel, lastUpdate);
        }
        catch(err) {
            this.logger.warn('Failed to update channel date', err);
        }
    }

    private async getGameUpdates(item: SubscribedItem, guild: Guild): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Game>[]> {
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Game>[] = [];
        const domain: string = item.entityid as string;
        const last_update = item.last_update;
        let newMods = item.show_new 
        ? (this.cache.games.new[domain] ?? []).filter(m => new Date(m.createdAt) >= last_update && modCanShow(m, item) )
        : [];
        // If there's nothing in the cache, we'll double check
        if (!newMods.length && item.show_new) {
            const filters: IModsFilter = { 
                gameDomainName: { value: domain, op: 'EQUALS' },
                createdAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' },
            }
            // Hide SFW content
            if (item.sfw === false) filters.adultContent = { value: true, op: 'EQUALS' };
            // Hide NSFW content
            if (item.nsfw === false) filters.adultContent = { value: false, op: 'EQUALS' };
            const res = await this.fakeUser.NexusMods.API.v2.Mods(
                filters, 
                { createdAt: { direction: 'ASC' } }
            );
            newMods = res.nodes;
        }
        // Map into the generic format.
        const formattedNew: IPostableSubscriptionUpdate<SubscribedItemType.Game>[] = [];
        for (const mod of newMods) {
            const embed = await subscribedItemEmbed(this.logger, mod, item, guild);
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

        let updatedMods: (IMod & { files?: IModFile[]})[] = item.show_updates 
        ? (this.cache.games.updated[domain] ?? []).filter(m => new Date(m.updatedAt) >= last_update && modCanShow(m, item) )
        : [];
        // If there's nothing in the cache, we'll double check
        if (!updatedMods.length && item.show_updates) {
            const filters: IModsFilter = { 
                gameDomainName: { value: domain, op: 'EQUALS' },
                updatedAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' },
                hasUpdated: { value: true, op: 'EQUALS' }
            }
            // Hide SFW content
            if (item.sfw === false && item.nsfw === true) filters.adultContent = { value: true, op: 'EQUALS' };
            // Hide NSFW content
            if (item.nsfw === false && item.sfw === true) filters.adultContent = { value: false, op: 'EQUALS' };
            const res = await this.fakeUser.NexusMods.API.v2.Mods(
                filters, 
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
            const embed = await subscribedItemEmbed(this.logger, mod, item, guild, true);
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
        // logMessage('Processing mod updates', item.title);
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Mod>[] = [];
        const modUid: string = item.entityid as string;
        // const ids = modUidToGameAndModId(modUid); // We can convert the UID to mod/game IDs, but we need to domain to look it up on the API.
        const last_update = item.last_update;
        const res = await this.fakeUser.NexusMods.API.v2.ModsByUid([modUid]);
        const mod: IModWithFiles = res[0];
        if (!mod) throw new Error(`Mod not found for ${modUid}`);
        if (['hidden', 'under_moderation'].includes(mod.status)) {
            this.logger.info('Mod is temporarily unavailable:', mod.status);
            if (item.last_status === 'published') {
                results.push(unavailableUpdate(mod, SubscribedItemType.Mod, item, mod.status))
                await saveLastUpdatedForSub(item.id, results[0].date, mod.status);
            }
            return results;
        }
        else if (['deleted', 'wastebinned'].includes(mod.status)){
            this.logger.info('Mod is permanently unavailable:', mod.status);
            if (item.last_status === 'published') {
                results.push(unavailableUpdate(mod, SubscribedItemType.Mod, item, mod.status))
                await deleteSubscription(item.id);
            }
            return results;
        } 
        mod.files = await this.fakeUser.NexusMods.API.v2.ModFiles(mod.game.id, mod.modId) ?? [];
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
            const embed = await subscribedItemEmbed(this.logger, {...mod, files: [file]}, item, guild);
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
        
        return results;
    } 

    private async getCollectionUpdates(item: SubscribedItem, guild: Guild): Promise<IPostableSubscriptionUpdate<SubscribedItemType.Collection>[]> {
        // logMessage('Processing collection updates', item.title);
        const results: IPostableSubscriptionUpdate<SubscribedItemType.Collection>[] = [];
        const {gameDomain, slug} = item.collectionIds!;
        const last_update = item.last_update;
        const collection = await this.fakeUser.NexusMods.API.v2.Collection(slug, gameDomain, true);
        if (!collection) throw new Error(`Collection not found for ${item.entityid}`);
        if (collection.collectionStatus === CollectionStatus.Moderated) {
            this.logger.info('Collection under moderation', item.title);
            if ([CollectionStatus.Listed, CollectionStatus.Unlisted].includes(item.last_status as CollectionStatus)) {
                results.push(unavailableUpdate(collection, SubscribedItemType.Collection, item, collection.collectionStatus))
                await saveLastUpdatedForSub(item.id, results[0].date, collection.collectionStatus);
            }
            return results;
        }
        else if (collection.collectionStatus === CollectionStatus.Discarded) {
            this.logger.info('Collection has been discarded', item.title);
            if ([CollectionStatus.Listed, CollectionStatus.Unlisted].includes(item.last_status as CollectionStatus)) {
                results.push(unavailableUpdate(collection, SubscribedItemType.Collection, item, collection.collectionStatus))
                await deleteSubscription(item.id);
            }
            return results;
        }
        const collectionUpdatedAt = new Date(collection.latestPublishedRevision.updatedAt);
        if (collectionUpdatedAt.getTime() <= last_update.getTime()) {
            // Collection hasn't been updated since we last checked.
            // logMessage('No updates found', item.title);
            return results;
        }
        const withRevisions = await this.fakeUser.NexusMods.API.v2.CollectionRevisions(gameDomain, slug);
        if (!withRevisions) throw new Error(`Unable to get revision data`);
        const revisions = withRevisions.revisions.filter(r => new Date(r.updatedAt).getTime() > last_update.getTime())
            .sort((a,b) => a.revisionNumber - b.revisionNumber)
            .slice(0, 5); // Limit to 5 collections as the embeds can be a lot bigger.
        if (!revisions.length) return results;
        // Map into updates
        for(const rev of revisions) {
            const merged = { ...collection, revisions: [rev] }
            const embed = await subscribedItemEmbed(this.logger, merged, item, guild);
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
                
        return results;
    } 

    private async getUserUpdates(item: SubscribedItem, guild: Guild): Promise<IPostableSubscriptionUpdate<SubscribedItemType.User>[]> {
        // logMessage('Processing user updates', item.title);
        const results: IPostableSubscriptionUpdate<SubscribedItemType.User>[] = [];
        const userId: number = item.entityid as number;
        const last_update = item.last_update;
        const user = await this.fakeUser.NexusMods.API.v2.FindUser(userId);
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
        }
        // See if they have any new content since the last check
        const newMods = await this.fakeUser.NexusMods.API.v2.Mods(
            {
                uploaderId: { value: userId.toString(), op: 'EQUALS' },
                createdAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' },
            },
            { createdAt: { direction: 'ASC' } }
        );
        for (const mod of newMods.nodes) {
            const embed = await subscribedItemEmbed(this.logger, {...user, mod: mod}, item, guild, undefined, UserEmbedType.NewMod);
            results.push({
                type: SubscribedItemType.User,
                entity:{ ...user, mod: mod },
                date: new Date(mod.createdAt),
                subId: item.id,
                embed: embed.data,
                crosspost: item.crosspost ?? false,
            });
        }
        const updatedMods = await this.fakeUser.NexusMods.API.v2.Mods(
            {
                uploaderId: { value: userId.toString(), op: 'EQUALS' },
                updatedAt: { value: Math.floor(last_update.getTime() / 1000).toString(), op: 'GT' },
                hasUpdated: { value: true, op: 'EQUALS' }
            },
            { updatedAt: { direction: 'ASC' } }
        );
        for (const mod of updatedMods.nodes) {
            const modFiles: IModFile[] = await this.fakeUser.NexusMods.API.v2.ModFiles(mod.game.id, mod.modId);
            const modWithFile = { ...mod, file: modFiles.filter(f => Math.floor(f.date *1000) > last_update.getTime()) }
            const embed = await subscribedItemEmbed(this.logger, {...user, mod: modWithFile}, item, guild, undefined, UserEmbedType.UpdatedMod);
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
        // const newCollections = await this.fakeUser.NexusMods.API.v2.Collections(
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
        // const updatedCollections = await this.fakeUser.NexusMods.API.v2.Collections(
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

        return results;
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
            if (mods.totalCount > 0) this.logger?.info(`Pre-cached ${mods.nodes.length}/${mods.totalCount} new mods for ${domain}`)
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
            if (mods.totalCount > 0) this.logger.info(`Pre-cached ${mods.nodes.length}/${mods.totalCount} updated mods for ${domain}`)
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

function modCanShow(mod: IMod, item: SubscribedItem) {
    if (item.nsfw === false && mod.adult === true) return false;
    if (item.sfw === false && mod.adult === false) return false;
    return true;
}