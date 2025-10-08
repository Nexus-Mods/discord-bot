import { 
    CommandInteraction, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction,
    TextChannel, Collection, Snowflake, Webhook, PermissionFlagsBits, MessageFlags, InteractionContextType
} from "discord.js";
import { ClientExt, DiscordInteraction } from '../types/DiscordTypes';
import { autoCompleteCollectionSearch, autocompleteGameName, autoCompleteModSearch, autoCompleteUserSearch, gameArt, Logger } from "../api/util";
import { SubscribedChannel, SubscribedItemType } from "../types/subscriptions";
import { createSubscribedChannel, getSubscribedChannel, totalItemsInGuild } from "../api/subscriptions";
import { DiscordBotUser, DummyNexusModsUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('track')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDescription('Track a game, mod, collection or user in this channel.')
    .addSubcommand(sc => 
        sc.setName('game')
        .setDescription('Track new mod uploads for a game.')
        .addStringOption(o =>
            o.setName('game')
            .setDescription('The title of the game.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(o =>
            o.setName('message')
            .setDescription('Post with updates. e.g. Role')
            .setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName('show_new')
            .setDescription('Show new mods. Default: True')
            .setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName('show_updates')
            .setDescription('Show updated mods. Default: True')
            .setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName('nsfw')
            .setDescription('Show adult content.')
            .setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName('sfw')
            .setDescription('Show non-adult content.')
            .setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName('compact')
            .setDescription('Use compact style cards.')
            .setRequired(false)
        )
    )
    .addSubcommand(sc =>
        sc.setName('mod')
        .setDescription('Track a specific mod page for updates')
        .addStringOption(o =>
            o.setName('mod')
            .setDescription('The mod to track.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(o =>
            o.setName('message')
            .setDescription('Post with updates. e.g. Role')
            .setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName('compact')
            .setDescription('Use compact style cards.')
            .setRequired(false)
        )
    )
    .addSubcommand(sc =>
        sc.setName('collection')
        .setDescription('Track a collection page for updates')
        .addStringOption(o =>
            o.setName('collection')
            .setDescription('The collection to track.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(o =>
            o.setName('message')
            .setDescription('Post with updates. e.g. Role')
            .setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName('compact')
            .setDescription('Use compact style cards.')
            .setRequired(false)
        )
    )
    .addSubcommand(sc => 
        sc.setName('user')
        .setDescription('Track a specific user for update to their mods.')
        .addStringOption(o =>
            o.setName('user')
            .setDescription('The user profile to track.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(o =>
            o.setName('message')
            .setDescription('Post with updates. e.g. Role')
            .setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName('compact')
            .setDescription('Use compact style cards.')
            .setRequired(false)
        )
    ) as SlashCommandBuilder,
    public: true,
    guilds: [],
    action,
    autocomplete,
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(err => { throw err });

    const channel = interaction.channel;
    if (channel?.isThread() || channel?.isDMBased()) {
        return interaction.editReply('This command cannot be used in threads or DMs. Please use it in a channel.');
    }

    const subCommand: SubscribedItemType = interaction.options.getSubcommand(true) as SubscribedItemType;
    try {
        switch (subCommand) {
            case SubscribedItemType.Game: return trackGame(client, interaction, logger);
            case SubscribedItemType.Mod: return trackMod(client, interaction, logger);
            case SubscribedItemType.Collection: return trackCollection(client, interaction, logger);
            case SubscribedItemType.User: return trackUser(client, interaction, logger);
            default: throw new Error(`Tracking for ${subCommand} is not implemented yet.`)
        }
    }
    catch(err) {
        if ((err as Error).message === 'Channel already subscribed to maximum number of items.') {
            await interaction.editReply(`This channel is already subscribed to maximum number of items (${client.subscriptions?.maxSubsPerGuild || 5}). Please untrack an item to add a new one.`);
            return;
        }
        else throw err;
    }
}

async function trackGame(client: ClientExt, interaction: ChatInputCommandInteraction, logger: Logger) {
    const { channel, guildTotal } = await ensureChannelisSubscribed(client, interaction, logger);
    // Get options from the command
    const gameDomain = interaction.options.getString('game', true);
    const compact = interaction.options.getBoolean('compact') ?? false;
    const show_new = interaction.options.getBoolean('show_new') ?? true;
    const show_updates = interaction.options.getBoolean('show_updates') ?? true;
    const nsfw = interaction.options.getBoolean('nsfw') ?? (interaction.channel as TextChannel).nsfw;
    const sfw = interaction.options.getBoolean('sfw') ?? true;
    const message = interaction.options.getString('message');
    if (nsfw === false && sfw === false) {
        return interaction.editReply('You have selected to hide both NSFW and SFW content, so no mods will show. Please try again.\n-# Note: When NSFW is not defined, the "Age-Restricted Channel" flag on this channel is used.');
    }
    // Get the game object for selected domain
    const game = (await client.gamesList!.getGames()).find(g => g.domain_name === gameDomain);

    const currentSubs = await channel.getSubscribedItems();
    let currentGameSub = currentSubs.find(s => s.entityid === gameDomain && s.type === SubscribedItemType.Game);

    const newData = {
        title: game!.name,
        entityid: gameDomain,
        type: SubscribedItemType.Game,
        owner: interaction.user.id,
        crosspost: false,
        compact,
        message,
        config: {
            show_new,
            show_updates,
            sfw,
            nsfw
        }
    };

    try { 
        if (currentGameSub) {
            currentGameSub = await channel.updateSub(currentGameSub.id, newData);
            logger.info('Updated existing game subscription', { game: currentGameSub.entityid, id: currentGameSub.id });
        }
        else {
            if (guildTotal > (client.subscriptions?.maxSubsPerGuild || 5)) {
                throw new Error('Channel already subscribed to maximum number of items.');
                // return interaction.editReply(`Channel already subscribed to maximum number of items (${client.subscriptions?.maxSubsPerGuild || 5}). Please untrack an item to add a new one.`);
            }
            currentGameSub = await channel.subscribe(newData);
            logger.info('Created new game subscription', { game: currentGameSub.entityid, id: currentGameSub.id });
        }

        // Update the subsription manager
        client.subscriptions?.updateChannel(channel);

        const embed = new EmbedBuilder()
        .setTitle('Game Tracked!')
        .setDescription(`Mods for ${game!.name} will be posted in this channel.`)
        .setColor('DarkGreen')
        .setThumbnail(gameArt(game!.id))
        .setFooter({ text: `ID: ${currentGameSub.id}` })
        .setTimestamp(currentGameSub.last_update);
        
        return await interaction.editReply({ embeds: [embed] });
        
    }
    catch(err) {
        logger.warn('Failed to track game', err);
        await interaction.editReply('Failed to track game!');
        throw err;
    }
}

async function trackMod(client: ClientExt, interaction: ChatInputCommandInteraction, logger: Logger) {
    const { channel, guildTotal } = await ensureChannelisSubscribed(client, interaction, logger);
    // Get options from the command
    const moduid: string = interaction.options.getString('mod', true);
    const compact: boolean = interaction.options.getBoolean('compact') ?? false;
    const message: string | null = interaction.options.getString('message');
    // Get the mod info
    const dummyUser = new DiscordBotUser(DummyNexusModsUser, logger);
    try {
        const queryRes = await dummyUser.NexusMods.API.v2.ModsByUid([moduid]);
        const mod = queryRes[0];
        if (!mod) throw new Error(`No mod exists for UID:${moduid}`);

        // See if we already have a sub for this mod?
        const currentSubs = await channel.getSubscribedItems();
        let currentGameSub = currentSubs.find(s => s.entityid === moduid && s.type === SubscribedItemType.Mod);

        const newData = {
            title: mod.name,
            entityid: mod.uid,
            type: SubscribedItemType.Mod,
            owner: interaction.user.id,
            crosspost: false,
            compact,
            message,
            config: {
                last_status: mod.status
            }
        }

        if (currentGameSub) {
            currentGameSub = await channel.updateSub(currentGameSub.id, newData);
            logger.info('Updated existing mod subscription', { modUid: currentGameSub.entityid, id: currentGameSub.id });
        }
        else {
            if (guildTotal > (client.subscriptions?.maxSubsPerGuild || 5)) {
                throw new Error('Channel already subscribed to maximum number of items.');
                // return interaction.editReply(`Channel already subscribed to maximum number of items (${client.subscriptions?.maxSubsPerGuild || 5}). Please untrack an item to add a new one.`);
            }
            currentGameSub = await channel.subscribe(newData);
            logger.info('Created new mod subscription', { modUid: currentGameSub.entityid, id: currentGameSub.id });
        }

        // Update the subsription manager
        client.subscriptions?.updateChannel(channel);

        const embed = new EmbedBuilder()
        .setTitle('Mod Tracked!')
        .setDescription(`Updates for ${mod.name} will be posted in this channel.`)
        .setColor('DarkGreen')
        .setThumbnail(mod.pictureUrl)
        .setFooter({ text: `ID: ${currentGameSub.id}` })
        .setTimestamp(currentGameSub.last_update);
        
        return await interaction.editReply({ embeds: [embed] });

    }
    catch(err) {
        logger.warn('Failed to track mod', err);
        await interaction.editReply('Failed to track mod!');
        throw err;
    }
}

async function trackCollection(client: ClientExt, interaction: ChatInputCommandInteraction, logger: Logger) {
    const { channel, guildTotal } = await ensureChannelisSubscribed(client, interaction, logger);
    // Get options from the command
    const collectionSlugAndDomain = interaction.options.getString('collection', true);
    const [domain, collectionSlug] = collectionSlugAndDomain.split(':');
    const compact = interaction.options.getBoolean('compact') ?? false;
    const message = interaction.options.getString('message');
    // Get the mod info
    const dummyUser = new DiscordBotUser(DummyNexusModsUser, logger);
    try {
        const collection = await dummyUser.NexusMods.API.v2.Collection(collectionSlug, domain, true);
        if (!collection) throw new Error(`No collection exists for ID:${collectionSlugAndDomain}`);

        // See if we already have a sub for this mod?
        const currentSubs = await channel.getSubscribedItems();
        let currentGameSub = currentSubs.find(s => s.entityid === collectionSlug && s.type === SubscribedItemType.Collection);

        const newData = {
            title: collection.name,
            entityid: collectionSlugAndDomain,
            type: SubscribedItemType.Collection,
            owner: interaction.user.id,
            crosspost: false,
            compact,
            message,
            config: {
                last_status: collection.collectionStatus
            }
        }

        if (currentGameSub) {
            currentGameSub = await channel.updateSub(currentGameSub.id, newData);
            logger.info('Updated existing collection subscription', { slug: currentGameSub.entityid, id: currentGameSub.id });
        }
        else {
            if (guildTotal > (client.subscriptions?.maxSubsPerGuild || 5)) {
                throw new Error('Channel already subscribed to maximum number of items.');
                // return interaction.editReply(`Channel already subscribed to maximum number of items (${client.subscriptions?.maxSubsPerGuild || 5}). Please untrack an item to add a new one.`);
            }
            currentGameSub = await channel.subscribe(newData);
            logger.info('Created new collection subscription', { slug: currentGameSub.entityid, id: currentGameSub.id });
        }

        // Update the subsription manager
        client.subscriptions?.updateChannel(channel);

        const embed = new EmbedBuilder()
        .setTitle('Collection Tracked!')
        .setDescription(`Updates for ${collection.name} will be posted in this channel.`)
        .setColor('DarkGreen')
        .setThumbnail(collection.tileImage.url)
        .setFooter({ text: `ID: ${currentGameSub.id}` })
        .setTimestamp(currentGameSub.last_update);
        
        return await interaction.editReply({ embeds: [embed] });

    }
    catch(err) {
        logger.warn('Failed to track collection', err);
        await interaction.editReply('Failed to track collection!');
        throw err;
    }
}

async function trackUser(client: ClientExt, interaction: ChatInputCommandInteraction, logger: Logger) {
    const { channel, guildTotal } = await ensureChannelisSubscribed(client, interaction, logger);
    // Get options from the command
    const userId: number = parseInt(interaction.options.getString('user', true));
    const compact = interaction.options.getBoolean('compact') ?? false;
    const message = interaction.options.getString('message');
    // Get the mod info
    const dummyUser = new DiscordBotUser(DummyNexusModsUser, logger);
    try {
        const user = await dummyUser.NexusMods.API.v2.FindUser(userId);
        if (!user) throw new Error(`No user exists for ID:${userId}`);

        // See if we already have a sub for this mod?
        const currentSubs = await channel.getSubscribedItems();
        let currentGameSub = currentSubs.find(s => s.entityid === userId && s.type === SubscribedItemType.User);

        const newData = {
            title: user.name,
            entityid: user.memberId,
            type: SubscribedItemType.User,
            owner: interaction.user.id,
            crosspost: false,
            compact,
            message,
            config: undefined
        }

        if (currentGameSub) {
            currentGameSub = await channel.updateSub(currentGameSub.id, newData);
            logger.info('Updated existing user subscription', { user: currentGameSub.entityid, id: currentGameSub.id });
        }
        else {
            if (guildTotal > (client.subscriptions?.maxSubsPerGuild || 5)) {
                throw new Error('Channel already subscribed to maximum number of items.');
                // return interaction.editReply(`Channel already subscribed to maximum number of items (${client.subscriptions?.maxSubsPerGuild || 5}). Please untrack an item to add a new one.`);
            }
            currentGameSub = await channel.subscribe(newData);
            logger.info('Created new user subscription', { user: currentGameSub.entityid, id: currentGameSub.id });
        }

        // Update the subsription manager
        client.subscriptions?.updateChannel(channel);

        const embed = new EmbedBuilder()
        .setTitle('User Profile Tracked!')
        .setDescription(`Updates from ${user.name} will be posted in this channel.`)
        .setColor('DarkGreen')
        .setThumbnail(user.avatar)
        .setFooter({ text: `ID: ${currentGameSub.id}` })
        .setTimestamp(currentGameSub.last_update);
        
        return await interaction.editReply({ embeds: [embed] });

    }
    catch(err) {
        logger.warn('Failed to track user', err);
        await interaction.editReply('Failed to track user!');
        throw err;
    }
}

async function ensureChannelisSubscribed(client: ClientExt, interaction: ChatInputCommandInteraction, logger: Logger): Promise<{channel: SubscribedChannel, guildTotal: number}> {
    const guild_id = interaction.guildId!;
    const existingChannel = await getSubscribedChannel(guild_id, interaction.channelId);
    if (existingChannel) {
        // Check if the guild has over 20 items.
        const total = await totalItemsInGuild(guild_id);
        logger.info('Total items in guild', { guild: interaction.guild?.name, total });
        return { channel: existingChannel, guildTotal: total };
    };
    // Channel isn't set up yet.
    const AllWebHooks: Collection<Snowflake, Webhook> = await (interaction.channel as TextChannel)?.fetchWebhooks().catch(() => new Collection()) || new Collection();
    let webHook = AllWebHooks.find(
        wh => wh.channelId === interaction.channelId 
        && wh.name === 'Nexus Mods Updates' 
        && !!wh.token 
        && wh.owner?.id === client.user!.id
    );
    if (!webHook) {
        try {
            webHook = await (interaction.channel as TextChannel).createWebhook({
                name: 'Nexus Mods Updates',
                avatar: client.user?.avatarURL(),
                reason: `Nexus Mods tracking requested by ${interaction.user.displayName}`
            })
        }
        catch(err) {
            const perms = (interaction.guild?.members.me)?.permissionsIn(interaction.channel!.id)
            logger.warn('Error creating webhook', {user: interaction.user.tag, guild: interaction.guild?.name, channel: interaction.channel?.toString(), err, perms });
            throw new Error(`Failed to create Webhook for tracking feed. Please make sure the bot has the correct permissions.\n Error: ${(err as Error).message || err}, Perms ${perms?.toArray()}`);
        }
    }

    const newChannel = await createSubscribedChannel({
        guild_id,
        channel_id: interaction.channelId,
        webhook_id: webHook.id,
        webhook_token: webHook.token!
    });
    return {channel: newChannel, guildTotal: 0};
}

async function autocomplete(client: ClientExt, interaction: AutocompleteInteraction, logger: Logger) {
    const focused = interaction.options.getFocused(true);

    switch (focused.name) {
        case 'game': return autocompleteGameName(client, interaction, logger);
        case 'mod': return autoCompleteModSearch(interaction, logger);
        case 'collection': return autoCompleteCollectionSearch(interaction, logger);
        case 'user': return autoCompleteUserSearch(interaction, logger);
    }
}

export { discordInteraction };