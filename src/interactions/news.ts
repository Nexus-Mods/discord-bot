import { CommandInteraction, MessageActionRow, MessageSelectMenu, Client, MessageSelectOptionData, MessageEmbed, Message, InteractionCollector, MessageButton } from "discord.js";
import { DiscordInteraction, InfoResult, PostableInfo } from "../types/util";
import { getAllInfos, displayInfo } from '../api/bot-db';
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'news',
        description: 'Refresh the news feed manually.',
        options: [{
            name: 'domain',
            type: 'STRING',
            description: 'Domain to check, for game-specific news.',
            required: false,
        }],
        // defaultPermission: false
    },
    public: false,
    guilds: [
        '581095546291355649'
    ],
    permissions: [
        // Admins in the Nexus Mods server.
        {
            guild: '215154001799413770',
            id: '215464099524378625',
            type: 'ROLE',
            permission: true
        },
        // Pickysaurus
        {
            id: '296052251234009089',
            type: 'USER',
            permission: true
        }
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<void> {
    // logMessage('News interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name });

    interaction.reply('Damn son!')

}

export { discordInteraction };