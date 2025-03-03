import { SlashCommandBuilder, PermissionFlagsBits, Client, CommandInteraction, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('commandupdate')
    .setDescription('Update the commands used by this bot.')
    .setDMPermission(true)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        '581095546291355649',
        '215154001799413770'
    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);

    await interaction.deferReply({ ephemeral: true }).catch((err) => { throw err });

    try {
        await client.updateInteractions?.(true);
        return interaction.followUp({content: 'Updated slash commands!', flags: MessageFlags.Ephemeral});
    }
    catch(err) {
        return interaction.followUp({content: 'Failed to update slash commands: '+((err as Error).message || err), flags: MessageFlags.Ephemeral});
    }


}

export { discordInteraction };
