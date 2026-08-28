import { 
    SlashCommandBuilder, PermissionFlagsBits, CommandInteraction, 
    ChatInputCommandInteraction, MessageFlags, InteractionContextType 
} from "discord.js";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes.js";
import { KnownDiscordServers, Logger } from "../api/util.js";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('commandupdate')
    .setDescription('Update the commands used by this bot.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        KnownDiscordServers.BotDemo,
        KnownDiscordServers.Main
    ],
    defer: 'ephemeral',
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, _logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);


    try {
        await client.updateInteractions?.(true);
        return interaction.followUp({content: 'Updated slash commands!', flags: MessageFlags.Ephemeral});
    }
    catch(err) {
        return interaction.followUp({content: 'Failed to update slash commands: '+((err as Error).message || err), flags: MessageFlags.Ephemeral});
    }


}

export { discordInteraction };
