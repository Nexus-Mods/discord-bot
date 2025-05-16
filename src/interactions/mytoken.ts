import { Client, SlashCommandBuilder, ChatInputCommandInteraction, CommandInteraction, Snowflake, PermissionFlagsBits } from "discord.js";
import { DiscordInteraction } from "../types/DiscordTypes";
import { DiscordBotUser } from "../api/DiscordBotUser";
import { getUserByDiscordId } from "../api/users";
import { KnownDiscordServers } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('mytoken')
    .setDescription('Get access token.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        KnownDiscordServers.BotDemo
    ],
    action,
}

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId: Snowflake | undefined = interaction.user.id;
    await interaction.deferReply({ephemeral: true}).catch(err => { throw err });;
    // Check if they are already linked.
    let userData : DiscordBotUser | undefined;
    try {
        userData = !!discordId ? await getUserByDiscordId(discordId) : undefined;
        if (!userData) throw new Error('User not found; please link your account first.');
        return interaction.editReply(`OAuth Access Token: \`${userData.NexusMods.Token()?.access_token}\``);
    }
    catch(err) {
        return interaction.editReply('Error getting user data: '+(err as Error).message);
    }
    
}

export { discordInteraction };