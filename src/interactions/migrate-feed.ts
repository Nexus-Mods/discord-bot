import { ChatInputCommandInteraction, CommandInteraction, PermissionFlagsBits, SlashCommandBuilder, WebhookClient } from "discord.js";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";
import { createSubscribedChannel, createSubscription, getSubscribedChannel } from "../api/subscriptions";
import { logMessage } from "../api/util";
import { SubscribedItemType } from "../types/subscriptions";
import { deleteGameFeed } from "../api/game_feeds";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('migrate-feed')
    .setDescription('Migrate a gamefeed to subscriptions.')
    .addNumberOption(option => 
        option.setName('id')
        .setDescription('ID to migrate')  
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    public: false,
    guilds: [
        '581095546291355649',
        '268004475510325248',

    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = baseInteraction as ChatInputCommandInteraction;
    const id = interaction.options.getNumber('id', true);
    await interaction.deferReply();

    const feed = await client.gameFeeds?.getFeed(id);
    if (!feed) return interaction.editReply('Feed not found');
    const guild_id = feed.guild;
    const channel_id = feed.channel;
    const whId = feed.webhook_id;
    const whToken = feed.webhook_token;
    if (!whId || !whToken) {
        return interaction.editReply('This interaction has no webhook data so cannot be migrated');
    }
    const whClient = new WebhookClient({ id: whId, token: whToken });
    try {
        const testMessage = await whClient.send('Testing migration from "GameFeed" to "SubscribedItem"...');
        await whClient.deleteMessage(testMessage);
    }
    catch(err) {
        console.log('Webhook test failed', err);
        return interaction.editReply('Webhook test failed. Could not migrate.');
    }
    let subscribedChannel = await getSubscribedChannel(guild_id, channel_id);
    if (!subscribedChannel) {
        logMessage('Creating subscribed channel');
        subscribedChannel = await createSubscribedChannel({ guild_id: guild_id, channel_id: channel_id, webhook_id: whId, webhook_token: whToken  });
    }
    // Convert to subscribed item
    try {
        const newSub = await createSubscription(subscribedChannel.id, {
            title: feed.title,
            type: SubscribedItemType.Game,
            entityid: feed.domain,
            owner: feed.owner,
            crosspost: feed.crosspost,
            compact: feed.compact,
            message: feed.message ?? null,
            nsfw: feed.nsfw,
            sfw: feed.sfw,
            show_new: feed.show_new,
            show_updates: feed.show_updates
        });
        logMessage('Migration successful', { feed, newSub });
        await whClient.send(`-# The game feed for ${newSub.title} has been successfully migrated to a tracked game.`);
        await deleteGameFeed(feed._id);
        return interaction.editReply('Migration complete!')
    }
    catch(err) {
        logMessage('Failed to migrate game feed', err, true);
        return interaction.editReply('Migration failed!');
    }
    
}

export { discordInteraction };