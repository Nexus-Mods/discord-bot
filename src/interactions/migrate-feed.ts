import { ChatInputCommandInteraction, CommandInteraction, PermissionFlagsBits, SlashCommandBuilder, WebhookClient } from "discord.js";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";
import { createSubscribedChannel, getSubscribedChannel } from "../api/subscriptions";
import { logMessage } from "../api/util";

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
    
}

export { discordInteraction };