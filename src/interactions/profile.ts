import { DiscordInteraction } from "../types/DiscordTypes.js";
import { getUserByDiscordId } from '../api/users.js';
import { CommandInteraction, Snowflake, EmbedBuilder, Client, CommandInteractionOption, SlashCommandBuilder, ChatInputCommandInteraction, InteractionContextType } from "discord.js";
import { KnownDiscordServers, Logger } from '../api/util.js';
import { DiscordBotUser } from "../api/DiscordBotUser.js";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show your profile card.')
    .addBooleanOption(option => 
        option.setName('public')
        .setDescription('Make your card visible to all users?')
        .setRequired(false) 
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM) as SlashCommandBuilder,
    public: true,
    guilds: [
        KnownDiscordServers.BotDemo
    ],
    defer: (i) => ((i as ChatInputCommandInteraction).options.getBoolean('public') ?? false) ? 'public' : 'ephemeral',
    action
}

async function action(client: Client, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // Private?

    // Get sender info.
    const discordId: Snowflake | undefined = interaction.user.id;
    // Check if they are already linked.
    let userData : DiscordBotUser | undefined;

    try {
        userData = discordId ? await getUserByDiscordId(discordId) : undefined;
        if (!userData) await interaction.followUp('You haven\'t linked your account yet. Use the /link command to get started.');
        else {
            const card: EmbedBuilder = await userData.ProfileEmbed(client);
            await interaction.followUp({ embeds: [card] });
        }
    }
    catch(err) {
        logger.warn('Error checking if user exists in DB when linking', err);
        await interaction.followUp('An error occurred fetching your account details.');
    }

}

export { discordInteraction };