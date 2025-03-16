import { 
    CommandInteraction, EmbedBuilder, User, 
    SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction,
    EmbedData, InteractionEditReplyOptions,
    TextChannel,
    Collection,
    Snowflake,
    Webhook
} from "discord.js";
import { ClientExt, DiscordInteraction } from '../types/DiscordTypes';
import { autocompleteGameName, autoCompleteModSearch, logMessage } from "../api/util";
import { SubscribedChannel, SubscribedItemType } from "../types/subscriptions";
import { createSubscribedChannel, getSubscribedChannel } from "../api/subscriptions";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('track')
    .setDescription('Return a quick info message on a number of topics.')
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
    )
    .addSubcommand(sc =>
        sc.setName('collection')
        .setDescription('Track a collection page for updates')
    )
    .addSubcommand(sc => 
        sc.setName('user')
        .setDescription('Track a specific user for update to their mods.')
    ) as SlashCommandBuilder,
    public: false,
    guilds: [
        '581095546291355649'
    ],
    action,
    autocomplete,
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ ephemeral: true }).catch(err => { throw err });

    const subCommand: SubscribedItemType = interaction.options.getSubcommand(true) as SubscribedItemType;
    switch (subCommand) {
        case SubscribedItemType.Game: return trackGame(client, interaction);
        default: throw new Error(`Tracking for ${subCommand} is not implemented yet.`)
    }
}

async function trackGame(client: ClientExt, interaction: ChatInputCommandInteraction) {
    const channel = await ensureChannelisSubscribed(client, interaction);
    // Get options from the command
    const gameDomain = interaction.options.getString('game', true);
    const compact = interaction.options.getBoolean('compact') ?? false;
    const show_new = interaction.options.getBoolean('show_new') ?? true;
    const show_updates = interaction.options.getBoolean('show_updates') ?? true;
    const nsfw = interaction.options.getBoolean('nsfw') ?? (interaction.channel as TextChannel).nsfw;
    const sfw = interaction.options.getBoolean('sfw') ?? true;
    const message = interaction.options.getString('message');
    // Get the game object for selected domain
    const game = (await client.gamesList!.getGames()).find(g => g.domain_name === gameDomain);

    const currentSubs = await channel.getSubscribedItems();
    const currentGameSub = currentSubs.find(s => s.entityid === gameDomain && s.type === SubscribedItemType.Game);

    const newData = {
        title: game!.name,
        entityid: gameDomain,
        type: SubscribedItemType.Game,
        owner: interaction.user.id,
        crosspost: false,
        compact,
        message,
        show_new,
        show_updates,
        sfw,
        nsfw
    };

    try {
        if (currentGameSub) {
            await channel.updateSub(currentGameSub.id, newData);
            logMessage('Updating existing subscription')
        }
        else {
            await channel.subscribe(newData);
            logMessage('Creating new subscription')
        }
        const embed = new EmbedBuilder()
        .setTitle('Game Tracked!')
        .setDescription(`New Mods for ${game!.name} will be posted in this channel`)
        .setColor('DarkGreen')
        .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game!.id}.jpg`)
        
        return await interaction.editReply({ embeds: [embed] });
        
    }
    catch(err) {
        logMessage('Failed to track game', err, true);
        await interaction.editReply('Failed to track game!');
        throw err;
    }
}

async function ensureChannelisSubscribed(client: ClientExt, interaction: ChatInputCommandInteraction): Promise<SubscribedChannel> {
    const guild_id = interaction.guildId!;
    const existingChannel = await getSubscribedChannel(guild_id, interaction.channelId);
    if (existingChannel) return existingChannel;
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
            logMessage('Error creating webhook', {user: interaction.user.tag, guild: interaction.guild?.name, channel: interaction.channel?.toString(), err}, true);
            throw new Error(`Failed to create Webhook for tracking feed. Please make sure the bot has the correct permissions.\n Error: ${(err as Error).message || err}`);
        }
    }

    const newChannel = await createSubscribedChannel({
        guild_id,
        channel_id: interaction.channelId,
        webhook_id: webHook.id,
        webhook_token: webHook.token!
    });
    return newChannel;
}

async function autocomplete(client: ClientExt, interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'game') return autocompleteGameName(client, interaction);
    else if (focused.name === 'mod') return autoCompleteModSearch(interaction);
}

export { discordInteraction };