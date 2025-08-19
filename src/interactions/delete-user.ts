import { ChatInputCommandInteraction, CommandInteraction, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getUserByDiscordId, getUserByNexusModsName, deleteUser } from '../api/bot-db';
import { KnownDiscordServers, Logger } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('delete-user')
    .setDescription('Testing Command.')
    .addStringOption(so =>
        so.setName('nexus')
        .setDescription('Username of the Nexus Mods account')
        .setRequired(false)
    )
    .addStringOption(so =>
        so.setName('discord')
        .setDescription('Discord ID')
        .setRequired(false)
    )
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,
    public: false,
    guilds: [
        KnownDiscordServers.BotDemo,
        KnownDiscordServers.Moderator,

    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const nexusUsername = interaction.options.getString('nexus');
    const discordId = interaction.options.getString('discord');

    if (!nexusUsername && !discordId) return interaction.editReply("Please specify a Nexus Mods Username or Discord ID.");

    let userToDelete: DiscordBotUser | undefined = undefined;
    
    if (nexusUsername) {
        try {
            userToDelete = await getUserByNexusModsName(nexusUsername);
            if (!userToDelete) throw new Error('Not found');
            await deleteUser(userToDelete.DiscordId);            
        }
        catch(err) {
            return interaction.editReply(`Failed to delete user for Nexus Mods Name: ${nexusUsername}. Error: ${(err as Error).message ?? err} `);
        }

    }
    else if (discordId) {
        try {
            userToDelete = await getUserByDiscordId(discordId);
            if (!userToDelete) throw new Error('Not found');
            await deleteUser(userToDelete.DiscordId);            
        }
        catch(err) {
            return interaction.editReply(`Failed to delete user for Discord ID: <@${discordId}>. Error: ${(err as Error).message ?? err} `);
        }
    }
    if (!userToDelete) return interaction.editReply(`No linked account found for Nexus Mods username: ${nexusUsername} or Discord <@${discordId}>`);

    return interaction.editReply(`Successfully deleted: ${userToDelete.NexusModsUsername}`);
}

export { discordInteraction } 