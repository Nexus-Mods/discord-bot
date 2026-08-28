import { CommandInteraction, Snowflake, Client, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessageFlags } from "discord.js";
import { DiscordInteraction } from "../types/DiscordTypes.js";
import { getUserByDiscordId } from '../api/bot-db.js';
import { KnownDiscordServers, Logger } from "../api/util.js";
import { unlinkUrl } from '../server/auth.js';

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Delete the link between your Nexus Mods account and Discord.')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
    public: true,
    guilds: [
        KnownDiscordServers.BotDemo
    ],
    action
}

async function action(client: Client, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId: Snowflake = interaction.user.id;
    await interaction.deferReply({flags: MessageFlags.Ephemeral}).catch(err => { throw err });;
    // See if they have existing data
    const userData = await getUserByDiscordId(discordId);
    if (userData) {
        // Existing user
        const unlinkEmbed = [new EmbedBuilder()
        .setTitle('Unlink Nexus Mods account')
        .setColor(0xda8e35)
        .setURL(unlinkUrl(discordId))
        .setDescription('Unlinking your account will remove all roles granted by your Nexus Mods account and you will not be able to use all features of the bot anymore.')
        .setThumbnail(userData.NexusModsAvatar || null)
        .setFooter({ text: 'Discord Bot - Nexus Mods', iconURL: client?.user?.avatarURL() || '' })];

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
        .setColor(0xda8e35)
        .setDescription('Your account is not current linked.')
        .setFooter({ text: 'Discord Bot - Nexus Mods', iconURL: client?.user?.avatarURL() || '' })];

        return interaction.editReply({ embeds: notLinkedEmbed });

    }

}

export { discordInteraction };