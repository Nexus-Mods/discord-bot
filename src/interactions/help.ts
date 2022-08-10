import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle, ChatInputCommandInteraction, CommandInteraction } from "discord.js";
import { DiscordInteraction } from "../types/DiscordTypes";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Information about this bot.'),
    public: true,
    action
}

const helpEmbed: EmbedBuilder = new EmbedBuilder()
.setTitle('Help')
.setDescription('You can visit Modding.wiki for a list of commands or report an issue on GitHub.')
.setColor(0xda8e35)
.setImage('https://images.nexusmods.com/oauth/applications/api_app_logo_1598554289_php9fzf1a.png');

const actions: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>()
.addComponents(
    new ButtonBuilder()
    .setLabel('Command List')
    .setStyle(ButtonStyle.Link)
    .setURL('https://modding.wiki/en/nexusmods/discord-bot#commands'),
    new ButtonBuilder()
    .setLabel('Support')
    .setStyle(ButtonStyle.Link)
    .setURL('https://discord.gg/nexusmods'),
    new ButtonBuilder()
    .setLabel('Report an Issue')
    .setStyle(ButtonStyle.Link)
    .setURL('https://github.com/Nexus-Mods/discord-bot/issues'),
);

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // logMessage('Help interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name, });
    return interaction.reply({ embeds: [helpEmbed], components: [actions] });
}

export { discordInteraction };