import { CommandInteraction, Client, MessageEmbed, MessageActionRow, MessageButton } from "discord.js";
import { DiscordInteraction, } from "../types/util";
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'help',
        description: 'Information about this bot.',
    },
    public: true,
    action
}

const helpEmbed: MessageEmbed = new MessageEmbed()
.setTitle('Help')
.setDescription('You can visit Modding.wiki for a list of commands or report an issue on GitHub.')
.setColor(0xda8e35)
.setImage('https://images.nexusmods.com/oauth/applications/api_app_logo_1598554289_php9fzf1a.png');

const actions: MessageActionRow = new MessageActionRow()
.addComponents(
    new MessageButton({
        label: 'Command List',
        style: 'LINK',
        url: 'https://modding.wiki/en/nexusmods/discord-bot#commands',
    }),
    new MessageButton({
        label: 'Support',
        style: 'LINK',
        url: 'https://discord.gg/nexusmods',
    }),
    new MessageButton({
        label: 'Report an Issue',
        style: 'LINK',
        url: 'https://github.com/Nexus-Mods/discord-bot/issues',
    }),
);

async function action(client: Client, interaction: CommandInteraction): Promise<any> {
    logMessage('Help interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name, });
    return interaction.reply({ embeds: [helpEmbed], components: [actions] });
}

export { discordInteraction };