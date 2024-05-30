import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getUserByDiscordId } from '../api/bot-db';
import { logMessage } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Automatic Moderator Command.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        '581095546291355649',
        '268004475510325248',

    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.user.id;
    const botuser: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
    if (!botuser) return interaction.editReply({ content: 'Error! No linked user!' });
    try {
        await botuser.NexusMods.Auth();
        logMessage('Nexus Mods Auth verfied.');

        const now = new Date()
        const fiveMinsAgo = new Date(now.valueOf() - (60000 * 60))

        // Quick test without params
        const test1 = await botuser.NexusMods.API.v2.LatestMods(fiveMinsAgo)

        // Quick test with game params
        const test2 = await botuser.NexusMods.API.v2.LatestMods(fiveMinsAgo, [ 1704, 1151 ])
        
        
        console.log({test1, test2})

        const embed1 = new EmbedBuilder()
        .setTitle('All games')
        .setDescription(test1.nodes.map(m => `- ${m.name} (${m.game?.name})`).join('\n') + ".")
        .setFields([{ name: 'total', value: `count of ${test1.totalCount}` }])

        const embed2 = new EmbedBuilder()
        .setTitle('Skyrim and Fallout 4')
        .setDescription(test2.nodes.map(m => `- ${m.name} (${m.game?.name})`).join('\n') + ".")
        .setFields([{ name: 'total', value: `count of ${test2.totalCount}` }])

        return interaction.editReply({ embeds: [embed1, embed2] })
    }
    catch(err) {
        logMessage('Error', err, true)
        return interaction.editReply({ content: 'Error! '+err });
    }
}

export { discordInteraction }