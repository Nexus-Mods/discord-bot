import { type ChatInputCommandInteraction, type CommandInteraction, type EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { DiscordInteraction, ClientExt } from "../types/DiscordTypes.js";
import { KnownDiscordServers } from '../api/util.js';
import type { Logger } from "../api/logger.js";
import { autocompleteGameName } from '../lib/autocomplete.js';
import { NewsFeedManager } from "../feeds/NewsFeedManager.js";

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
    defer: 'ephemeral',
    action,
    autocomplete: autocompleteGameName
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);

    const domain: string|null = interaction.options.getString('domain'); 
    const newsInst: NewsFeedManager = await NewsFeedManager.getInstance(client, logger);

    try {
        const latest = await newsInst.forceUpdate(domain?.toLowerCase());
        const embed: EmbedBuilder = latest as EmbedBuilder;
        await interaction.editReply({ content: 'Update successful', embeds: [embed]});
    }
    catch(err) {
        logger.warn('Failed to update news', err);
        return interaction.editReply('Failed to update news:'+(err as Error).message);
    }
}

export { discordInteraction };