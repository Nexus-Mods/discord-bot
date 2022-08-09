import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { logMessage } from "../api/util";
import { NewsFeedManager } from "../feeds/NewsFeedManager";
import { SavedNewsData } from "../types/feeds";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Refresh the news feed manually.')
    .addStringOption(option => 
        option.setName('domain')
        .setDescription('Domain to check, for game-specific news.')    
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    public: false,
    guilds: [
        '581095546291355649',
        '268004475510325248',

    ],
    action
}

async function action(client: ClientExt, interaction: ChatInputCommandInteraction): Promise<any> {
    // logMessage('News interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name });

    // Ignore anyone who isn't an owner.
    if (!client.config.ownerID?.includes(interaction.user.id)) return interaction.reply('Only bot owners can use this command.');

    await interaction.deferReply({ ephemeral: true });

    const domain: string|null = interaction.options.getString('domain'); 
    const newsInst: NewsFeedManager = NewsFeedManager.getInstance(client);

    try {
        const latest = await newsInst.forceUpdate(domain?.toLowerCase());
        let embed: EmbedBuilder;
        if (!(latest as EmbedBuilder)) {
            embed = new EmbedBuilder()
            .setTitle((latest as SavedNewsData)?.title || 'Unknown')
            .setTimestamp((latest as SavedNewsData)?.date);
        }
        else embed = latest as EmbedBuilder;
        await interaction.editReply({ content: 'Update successful', embeds: [embed]});
    }
    catch(err) {
        logMessage('Failed to update news', err, true);
        return interaction.editReply('Failed to update news:'+(err as Error).message);
    }
}

export { discordInteraction };