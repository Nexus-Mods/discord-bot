import { ChatInputCommandInteraction, CommandInteraction, PermissionFlagsBits, SlashCommandBuilder, WebhookClient } from "discord.js";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";
import { createSubscribedChannel, createSubscription, getSubscribedChannel } from "../api/subscriptions";
import { logMessage } from "../api/util";
import { SubscribedItemType } from "../types/subscriptions";
import { deleteGameFeed } from "../api/game_feeds";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('migrate-feeds')
    .setDescription('Migrate gamefeeds to subscriptions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,
    public: false,
    guilds: [
        '581095546291355649',
        '268004475510325248',

    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = baseInteraction as ChatInputCommandInteraction;
    await interaction.deferReply();

    const feeds = client.gameFeeds?.getAllFeeds();
    const migratable = feeds?.filter(f => f.show_updates === false) ?? [];

    logMessage('Migrating feeds', migratable.length);

    for (const feed of migratable) {
        const guild_id = feed.guild;
        const guild = await client.guilds.fetch(guild_id);
        if (!guild) continue;
        const channel_id = feed.channel;
        const whId = feed.webhook_id;
        const whToken = feed.webhook_token;
        if (!whId || !whToken) {
            await interaction.followUp(`Feed ${feed._id} for ${feed.domain} in ${guild.name} has no webhook data so cannot be migrated`);
            continue;
        }
        const whClient = new WebhookClient({ id: whId, token: whToken });
        try {
            const testMessage = await whClient.send('Testing migration from "GameFeed" to "SubscribedItem"...');
            await whClient.deleteMessage(testMessage);
        }
        catch(err) {
            console.log('Webhook test failed', {err, feed});
            await interaction.editReply(`Webhook test failed. Could not migrate. Feed ${feed._id} for ${feed.domain} in ${guild.name}`);
            continue;
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
            await whClient.send(`-# The game feed for ${newSub.title} has been successfully migrated to a tracked game. Use \`/track\` and \`/untrack\` to manage these feeds in future.`);
            await deleteGameFeed(feed._id);
            await interaction.followUp(`Migration complete! `)
            continue;
        }
        catch(err) {
            logMessage('Failed to migrate game feed', err, true);
            await interaction.followUp(`Migration failed!`);
            continue;
        }
    }
    
}

export { discordInteraction };