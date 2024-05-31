import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";

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

    const report = client.automod?.lastReport

    if (!report) return interaction.editReply({ content: 'Report not available' })

    const highConcern = report?.filter(r => r.flags.high.length > 0) || [];
    const lowConcern = report?.filter(r => r.flags.low.length > 0 && r.flags.high.length === 0) || [];
    const noConcern = report?.filter(r => r.flags.low.length === 0 && r.flags.high.length === 0) || [];

    const modToRow = (m: any) => `- [${m.mod.name}](https://nexusmods.com/${m.mod.game?.domainName}/mods/${m.mod.modId})`

    const highEmbed = new EmbedBuilder()
    .setTitle('Automod report')
    .addFields(
        [
            {
                name: 'High Risk Mods',
                value: `Mods with major flags\n`+(highConcern.map(modToRow).join('\n') || '_None_')
            },
            {
                name: 'Low Risk Mods',
                value: `Mods with minor flags\n`+(lowConcern.map(modToRow).join('\n') || '_None_')
            },
            {
                name: 'Safe Mods',
                value: `Mods with no flags\n`+(noConcern.map(modToRow).join('\n') || '_None_')
            },

        ]
    )
    .setColor('DarkOrange')


    return interaction.editReply({ embeds: [highEmbed] })
}

export { discordInteraction }