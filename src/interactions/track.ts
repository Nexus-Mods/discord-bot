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
import { autocompleteGameName, logMessage } from "../api/util";
import { ITip } from "../api/tips";
import { TipCache } from "../types/util";
import { SubscribedItemType } from "../types/subscriptions";
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
    )
    .addSubcommand(sc =>
        sc.setName('mod')
        .setDescription('Track a specific mod page for updates')
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
    autocomplete: autocompleteGameName
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
    await ensureChannelisSubscribed(client, interaction);
}

async function ensureChannelisSubscribed(client: ClientExt, interaction: ChatInputCommandInteraction) {
    const guild_id = interaction.guildId!;
    const existingChannel = await getSubscribedChannel(guild_id, interaction.channelId);
    if (existingChannel) return;
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

    await createSubscribedChannel({
        guild_id,
        channel_id: interaction.channelId,
        webhook_id: webHook.id,
        webhook_token: webHook.token!
    });
}

export { discordInteraction };