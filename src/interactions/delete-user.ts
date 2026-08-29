import { type ChatInputCommandInteraction, type CommandInteraction, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { DiscordInteraction, ClientExt } from "../types/DiscordTypes.js";
import { deleteUser, getUserByDiscordId, getUserByNexusModsName } from '../api/users.js';
import { KnownDiscordServers, type Logger } from "../api/util.js";
import type { DiscordBotUser } from "../api/DiscordBotUser.js";

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
    defer: 'ephemeral',
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, _logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);

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