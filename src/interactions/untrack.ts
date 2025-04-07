import { 
    CommandInteraction, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction,
    PermissionFlagsBits, GuildChannel, APIEmbedField,ActionRowBuilder, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ComponentType,
    MessageFlags,
    InteractionContextType
} from "discord.js";
import { ClientExt, DiscordInteraction } from '../types/DiscordTypes';
import { SubscribedItem, SubscribedItemType } from "../types/subscriptions";
import { deleteSubscribedChannel, deleteSubscription, getSubscribedChannel } from "../api/subscriptions";
import { Logger } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('untrack')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDescription('Untrack a game, mod, collection or user in this channel'),
    public: true,
    guilds: [],
    action
};

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(err => { throw err });

    const channel = interaction.channel;
    if (channel?.isThread() || channel?.isDMBased()) {
        return interaction.editReply('This command cannot be used in threads or DMs. Please use it in a channel.');
    }

    // Check if we have a subbed channel
    const subbedChannel = await getSubscribedChannel(interaction.guildId!, interaction.channelId);
    if (!subbedChannel) return interaction.editReply(`No tracked items for this channel.`);
    // Get items
    const items = await subbedChannel.getSubscribedItems();
    if (!items.length) return interaction.editReply('No tracked items')


    // Show the user a list of subscribed items
    const embed = new EmbedBuilder()
    .setTitle(`Tracked items in ${(interaction.channel as GuildChannel).name}`)
    .setDescription('Use the selector below to untrack an item.')
    .addFields(items.map(subscribedItemEmbedField));

    const selector = new StringSelectMenuBuilder()
    .setCustomId('item-selector')
    .setPlaceholder('Select the item(s) to untrack...')
    .addOptions(
        items.map(s => 
            new StringSelectMenuOptionBuilder()
            .setLabel(s.title)
            .setValue(s.id.toString())
            .setDescription(`${s.type.toUpperCase()} - ID: ${s.id}`)
        )
    )
    .setMinValues(0)
    .setMaxValues(items.length);

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selector);

    const reply = await interaction.editReply({ embeds: [embed], components: [actionRow] }); 

    const collector = reply.createMessageComponentCollector<ComponentType.StringSelect>({ time: 3_600_000 });

    collector.on('collect', async i => {
        await i.deferUpdate();
        collector.stop('Completed action');
        await i.editReply({ components: [] });
        const selected = i.values;
        if (!selected || !selected.length) return i.followUp('No subscriptions were deleted.');
        const promises = selected.map(async id => {
            const sub = items.find(i => i.id === parseInt(id));
            if (!sub) return logger.warn('Subscription not found to delete', { id });
            await deleteSubscription(sub.id);
            logger.info('Deleted subscription', { id, title: sub?.title });
            return interaction.followUp(`-# Deleted ${sub.type} subsription for ${sub.title}.`);
        });
        await Promise.all(promises);
        // Refresh the subs for the channel
        const newSubs = await subbedChannel.getSubscribedItems(true);
        // if there are no more subs, delete the channel
        if (!newSubs.length) await deleteSubscribedChannel(subbedChannel);
        return i.editReply({ content:`Untracked ${selected.length} item(s)` });
    });
}

function subscribedItemEmbedField(i: SubscribedItem): APIEmbedField {
    switch (i.type) {
        case SubscribedItemType.Game: return {name: `${i.title} (ID: ${i.id})`, value:`Show New: ${i.show_new} | Show Updates: ${i.show_updates}\nAdult Content: ${i.nsfw} | Non-adult Content: ${i.sfw}\nCompact: ${i.compact} | Crosspost: ${i.crosspost}`};
        case SubscribedItemType.Mod: return {name: `${i.title} (ID: ${i.id})`, value:`Compact: ${i.compact} | Crosspost: ${i.crosspost}`};
        case SubscribedItemType.Collection: return {name: `${i.title} (ID: ${i.id})`, value:`Compact: ${i.compact} | Crosspost: ${i.crosspost}`};
        case SubscribedItemType.User: return {name: `${i.title} (ID: ${i.id})`, value:`Compact: ${i.compact} | Crosspost: ${i.crosspost}`};
        default: return {name: `${i.title} (ID: ${i.id})`, value:`Unknown item type ${i.type}`};
    }
}

export { discordInteraction };