import { CommandInteraction, MessageActionRow, MessageSelectMenu, Client, MessageSelectOptionData, MessageEmbed, Message, InteractionCollector, MessageButton } from "discord.js";
import { DiscordInteraction, InfoResult, PostableInfo, ClientExt } from "../types/util";
import { getAllInfos, displayInfo } from '../api/bot-db';
import { logMessage } from "../api/util";
import { NewsFeedManager } from "../feeds/NewsFeedManager";
import { SavedNewsData } from "../types/feeds";

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
        '581095546291355649',
        '268004475510325248',

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

async function action(client: ClientExt, interaction: CommandInteraction): Promise<any> {
    // logMessage('News interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name });

    // Ignore anyone who isn't an owner.
    if (!client.config.ownerID?.includes(interaction.user.id)) return interaction.reply('Only bot owners can use this command');

    await interaction.deferReply({ ephemeral: true });

    const domain: string|null = interaction.options.getString('domain'); 
    const newsInst: NewsFeedManager = NewsFeedManager.getInstance(client);

    try {
        const latest = await newsInst.forceUpdate(domain?.toLowerCase());
        let embed: MessageEmbed;
        if (!(latest as MessageEmbed)) {
            embed = new MessageEmbed()
            .setTitle(latest?.title || 'Unknown')
            .setTimestamp((latest as SavedNewsData)?.date);
        }
        else embed = latest as MessageEmbed;
        await interaction.editReply({ content: 'Update successful', embeds: [embed]});
    }
    catch(err) {
        logMessage('Failed to update news', err, true);
        return interaction.editReply('Failed to update news:'+err.message);
    }
}

export { discordInteraction };