import { ChatInputCommandInteraction, CommandInteraction, PermissionFlagsBits, SlashCommandBuilder, TextChannel, WebhookClient } from "discord.js";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";
import { createSubscribedChannel, createSubscriptionFromFeed, getSubscribedChannel } from "../api/subscriptions";
import { KnownDiscordServers, Logger } from "../api/util";
import { SubscribedItemType } from "../types/subscriptions";
import { deleteGameFeed } from "../api/game_feeds";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('migrate-feeds')
    .setDescription('Migrate gamefeeds to subscriptions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,
    public: false,
    guilds: [
        KnownDiscordServers.BotDemo,
        KnownDiscordServers.Moderator
    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = baseInteraction as ChatInputCommandInteraction;
    await interaction.deferReply();

    const feeds = client.gameFeeds?.getAllFeeds() || [];

    logger.info('Migrating feeds', feeds.length);
    client.subscriptions?.pause();

    for (const feed of feeds) {
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
            logger.warn('Webhook test failed', {err, feed});
            await interaction.followUp(`Webhook test failed. Could not migrate. Feed ${feed._id} for ${feed.domain} in ${guild.name}`);
            const ch = await guild.channels.fetch(channel_id).catch(() => null);
            if (ch) (ch as TextChannel).send(`-# Game feed ${feed._id} for ${feed.domain} cancelled as the webhook no longer exists. Use the /track command to set it back up again.`).catch(() => null);
            await deleteGameFeed(feed._id);
            continue;
        }
        let subscribedChannel = await getSubscribedChannel(guild_id, channel_id);
        if (!subscribedChannel) {
            logger.info('Creating subscribed channel');
            subscribedChannel = await createSubscribedChannel({ guild_id: guild_id, channel_id: channel_id, webhook_id: whId, webhook_token: whToken  });
        }
        // Convert to subscribed item
        try {
            const newSub = await createSubscriptionFromFeed(subscribedChannel.id, {
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
                show_updates: feed.show_updates,
                last_update: feed.last_timestamp,
                created: feed.created
            });
            logger.info('Migration successful', { feed, newSub });
            await whClient.send(`-# The game feed for ${newSub.title} has been successfully migrated to a tracked game. Use \`/track\` and \`/untrack\` to manage these feeds in future.`);
            await deleteGameFeed(feed._id);
            await interaction.followUp(`Migration complete! Feed ${feed._id} for ${feed.domain} in ${guild.name}`)
            continue;
        }
        catch(err) {
            logger.warn('Failed to migrate game feed', { err, feed });
            await interaction.followUp(`Migration failed! Feed ${feed._id} for ${feed.domain} in ${guild.name}`);
            continue;
        }
    }

    client.subscriptions?.resume();
    return interaction.editReply('Migration done!')
    
}

export { discordInteraction };