import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { autocompleteGameName, KnownDiscordServers, logMessage } from "../api/util";
import { NewsFeedManager } from "../feeds/NewsFeedManager";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Refresh the news feed manually.')
    .addStringOption(option => 
        option.setName('domain')
        .setDescription('Domain to check, for game-specific news.')
        .setAutocomplete(true)    
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    public: false,
    guilds: [
        KnownDiscordServers.BotDemo,
        KnownDiscordServers.Moderator,

    ],
    action,
    autocomplete: autocompleteGameName
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const domain: string|null = interaction.options.getString('domain'); 
    const newsInst: NewsFeedManager = await NewsFeedManager.getInstance(client);

    try {
        const latest = await newsInst.forceUpdate(domain?.toLowerCase());
        let embed: EmbedBuilder;
        embed = latest as EmbedBuilder;
        await interaction.editReply({ content: 'Update successful', embeds: [embed]});
    }
    catch(err) {
        logMessage('Failed to update news', err, true);
        return interaction.editReply('Failed to update news:'+(err as Error).message);
    }
}

export { discordInteraction };