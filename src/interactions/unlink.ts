import { type CommandInteraction, type Snowflake, type Client, SlashCommandBuilder, type ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType } from "discord.js";
import type { DiscordInteraction } from "../types/DiscordTypes.js";
import { getUserByDiscordId } from '../api/users.js';
import { KnownDiscordServers, type Logger } from "../api/util.js";
import { unlinkUrl } from '../server/auth.js';
import { NEXUS_ORANGE, botFooter } from '../lib/embeds.js';

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Delete the link between your Nexus Mods account and Discord.')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
    public: true,
    guilds: [
        KnownDiscordServers.BotDemo
    ],
    defer: 'ephemeral',
    action
}

async function action(client: Client, baseInteraction: CommandInteraction, _logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId: Snowflake = interaction.user.id;
    // See if they have existing data
    const userData = await getUserByDiscordId(discordId);
    if (userData) {
        // Existing user
        const unlinkEmbed = [new EmbedBuilder()
        .setTitle('Unlink Nexus Mods account')
        .setColor(NEXUS_ORANGE)
        .setURL(unlinkUrl(discordId))
        .setDescription('Unlinking your account will remove all roles granted by your Nexus Mods account and you will not be able to use all features of the bot anymore.')
        .setThumbnail(userData.NexusModsAvatar || null)
        .setFooter(botFooter(client))];

        const unlinkButton = [new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
            .setLabel('Unlink accounts')
            .setStyle(ButtonStyle.Link)
            .setURL(unlinkUrl(discordId))
        )];

        return interaction.editReply({ embeds: unlinkEmbed, components: unlinkButton });

    }
    else {
        // Not linked!
        const notLinkedEmbed = [new EmbedBuilder()
        .setTitle('Unlink Nexus Mods account')
        .setColor(NEXUS_ORANGE)
        .setDescription('Your account is not current linked.')
        .setFooter(botFooter(client))];

        return interaction.editReply({ embeds: notLinkedEmbed });

    }

}

export { discordInteraction };