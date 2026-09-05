import { 
    type CommandInteraction, EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction, type AutocompleteInteraction,
    type TextChannel, Collection, type Snowflake, type Webhook, PermissionFlagsBits, InteractionContextType
} from "discord.js";
import type { ClientExt, DiscordInteraction } from '../types/DiscordTypes.js';
import { gameArt } from '../api/util.js';
import type { Logger } from "@nexusmods/core/logger.js";
import { autoCompleteCollectionSearch, autocompleteGameName, autoCompleteModSearch, autoCompleteUserSearch } from '../lib/autocomplete.js';
import { type SubscribedChannel, SubscribedItemType } from "../types/subscriptions.js";
import { createSubscribedChannel, getSubscribedChannel, totalItemsInGuild } from "../api/subscriptions.js";
import { DiscordBotUser, DummyNexusModsUser } from "../api/DiscordBotUser.js";
import { AppError, NotFoundError, ValidationError } from '@nexusmods/core/errors.js';
import { getSubscribedItems, subscribeChannelTo, updateChannelSubscription, type NewSubscriptionData } from '../api/subscriptions.js';

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
    defer: 'ephemeral',
    action,
    autocomplete,
}

/**
 * Raised when a guild is at its subscription limit. Was a string comparison on the
 * error message in four places.
 */
class SubscriptionLimitError extends AppError {
    constructor(limit: number) {
        super(`Guild is at its subscription limit of ${limit}`, {
            code: 'VALIDATION',
            userMessage: `This channel is already subscribed to the maximum number of items (${limit}). Please untrack an item to add a new one.`,
        });
    }
}

/** Everything the shared tracking path needs, once the entity has been resolved. */
interface ResolvedTarget {
    /** Stored on the subscription AND used to find an existing one. Must be the same value for both. */
    entityid: string | number;
    title: string;
    thumbnail: string | null;
    embedTitle: string;
    description: string;
    config: Record<string, unknown> | undefined;
}

/** A resolver may instead bail out with a message for the user. */
type Resolution = ResolvedTarget | { reply: string };

async function resolveGame(client: ClientExt, interaction: ChatInputCommandInteraction): Promise<Resolution> {
    const gameDomain = interaction.options.getString('game', true);
    const nsfw = interaction.options.getBoolean('nsfw') ?? (interaction.channel as TextChannel).nsfw;
    const sfw = interaction.options.getBoolean('sfw') ?? true;
    if (nsfw === false && sfw === false) {
        return { reply: 'You have selected to hide both NSFW and SFW content, so no mods will show. Please try again.\n-# Note: When NSFW is not defined, the "Age-Restricted Channel" flag on this channel is used.' };
    }

    const game = (await client.gamesList!.getGames()).find(g => g.domain_name === gameDomain);
    if (!game) throw new NotFoundError(`No game exists for domain ${gameDomain}`);

    return {
        entityid: gameDomain,
        title: game.name,
        thumbnail: gameArt(game.id),
        embedTitle: 'Game Tracked!',
        description: `Mods for ${game.name} will be posted in this channel.`,
        config: {
            show_new: interaction.options.getBoolean('show_new') ?? true,
            show_updates: interaction.options.getBoolean('show_updates') ?? true,
            sfw,
            nsfw,
        },
    };
}

async function resolveMod(_client: ClientExt, interaction: ChatInputCommandInteraction, logger: Logger): Promise<Resolution> {
    const moduid = interaction.options.getString('mod', true);
    const dummyUser = new DiscordBotUser(DummyNexusModsUser, logger);
    const [mod] = await dummyUser.NexusMods.API.v2.ModsByUid([moduid]);
    if (!mod) throw new NotFoundError(`No mod exists for UID ${moduid}`);

    return {
        entityid: mod.uid,
        title: mod.name,
        thumbnail: mod.pictureUrl,
        embedTitle: 'Mod Tracked!',
        description: `Updates for ${mod.name} will be posted in this channel.`,
        config: { last_status: mod.status },
    };
}

async function resolveCollection(_client: ClientExt, interaction: ChatInputCommandInteraction, logger: Logger): Promise<Resolution> {
    const slugAndDomain = interaction.options.getString('collection', true);
    const [domain, slug] = slugAndDomain.split(':');
    const dummyUser = new DiscordBotUser(DummyNexusModsUser, logger);
    const collection = await dummyUser.NexusMods.API.v2.Collection(slug, domain, true);
    if (!collection) throw new NotFoundError(`No collection exists for ${slugAndDomain}`);

    return {
        // Note: the whole "domain:slug" string. The old code stored this but searched
        // for an existing subscription using the bare slug, so the lookup never
        // matched and re-tracking a collection silently created a duplicate.
        entityid: slugAndDomain,
        title: collection.name,
        thumbnail: collection.tileImage?.url ?? null,
        embedTitle: 'Collection Tracked!',
        description: `Updates for ${collection.name} will be posted in this channel.`,
        config: { last_status: collection.collectionStatus },
    };
}

async function resolveUser(_client: ClientExt, interaction: ChatInputCommandInteraction, logger: Logger): Promise<Resolution> {
    const userId = parseInt(interaction.options.getString('user', true));
    const dummyUser = new DiscordBotUser(DummyNexusModsUser, logger);
    const user = await dummyUser.NexusMods.API.v2.FindUser(userId);
    if (!user) throw new NotFoundError(`No user exists for ID ${userId}`);

    return {
        entityid: user.memberId,
        title: user.name,
        thumbnail: user.avatar,
        embedTitle: 'User Profile Tracked!',
        description: `Updates from ${user.name} will be posted in this channel.`,
        config: undefined,
    };
}

const resolvers: Record<SubscribedItemType, {
    label: string;
    resolve: (client: ClientExt, interaction: ChatInputCommandInteraction, logger: Logger) => Promise<Resolution>;
}> = {
    [SubscribedItemType.Game]: { label: 'game', resolve: resolveGame },
    [SubscribedItemType.Mod]: { label: 'mod', resolve: resolveMod },
    [SubscribedItemType.Collection]: { label: 'collection', resolve: resolveCollection },
    [SubscribedItemType.User]: { label: 'user', resolve: resolveUser },
};

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);

    const channel = interaction.channel;
    if (channel?.isThread() || channel?.isDMBased()) {
        return interaction.editReply('This command cannot be used in threads or DMs. Please use it in a channel.');
    }

    const subCommand = interaction.options.getSubcommand(true) as SubscribedItemType;
    const target = resolvers[subCommand];
    if (!target) throw new ValidationError(`Tracking for ${subCommand} is not implemented yet.`);

    try {
        return await track(client, interaction, logger, subCommand, target);
    }
    catch (err) {
        if (err instanceof SubscriptionLimitError) return interaction.editReply(err.userMessage);
        logger.warn(`Failed to track ${target.label}`, err);
        await interaction.editReply(`Failed to track ${target.label}!`);
        throw err;
    }
}

/**
 * The shared path. This was duplicated four times - once per subcommand - with the
 * copies differing only in how the entity is resolved and how the confirmation embed
 * reads. All four also carried a variable named `currentGameSub`, including the one
 * handling users.
 */
async function track(
    client: ClientExt,
    interaction: ChatInputCommandInteraction,
    logger: Logger,
    type: SubscribedItemType,
    target: { label: string; resolve: (c: ClientExt, i: ChatInputCommandInteraction, l: Logger) => Promise<Resolution> },
): Promise<unknown> {
    const { channel, guildTotal } = await ensureChannelisSubscribed(client, interaction, logger);

    const resolved = await target.resolve(client, interaction, logger);
    if ('reply' in resolved) return interaction.editReply(resolved.reply);

    const newData = {
        title: resolved.title,
        entityid: resolved.entityid,
        type,
        owner: interaction.user.id,
        crosspost: false,
        compact: interaction.options.getBoolean('compact') ?? false,
        message: interaction.options.getString('message'),
        config: resolved.config,
    } as NewSubscriptionData;

    const existing = (await getSubscribedItems(channel))
        .find(s => s.entityid === resolved.entityid && s.type === type);

    let subscription;
    if (existing) {
        subscription = await updateChannelSubscription(channel, existing.id, newData);
        logger.info(`Updated existing ${target.label} subscription`, { entityid: subscription.entityid, id: subscription.id });
    }
    else {
        const limit = client.subscriptions?.maxSubsPerGuild || 5;
        if (guildTotal > limit) throw new SubscriptionLimitError(limit);
        subscription = await subscribeChannelTo(channel, newData);
        logger.info(`Created new ${target.label} subscription`, { entityid: subscription.entityid, id: subscription.id });
    }

    client.subscriptions?.updateChannel(channel);

    const embed = new EmbedBuilder()
    .setTitle(resolved.embedTitle)
    .setDescription(resolved.description)
    .setColor('DarkGreen')
    .setThumbnail(resolved.thumbnail)
    .setFooter({ text: `ID: ${subscription.id}` })
    .setTimestamp(subscription.last_update);

    return interaction.editReply({ embeds: [embed] });
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
            throw new Error(`Failed to create Webhook for tracking feed. Please make sure the bot has the correct permissions.\n Error: ${(err as Error).message || err}, Perms ${perms?.toArray()}`, { cause: err });
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