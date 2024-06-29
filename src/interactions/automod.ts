import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { logMessage } from "../api/util";

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

    const report = client.automod?.lastReports
    const reportsMerged = report?.reduce((prev, cur) => {
        if (cur.length) prev = [...prev, ...cur];
        return prev;
    }, [])

    if (!report) return interaction.editReply({ content: 'Report not available' })

    const highConcern = reportsMerged?.filter(r => r.flags.high.length > 0) || [];
    const lowConcern = reportsMerged?.filter(r => r.flags.low.length > 0 && r.flags.high.length === 0) || [];
    const noConcern = reportsMerged?.filter(r => r.flags.low.length === 0 && r.flags.high.length === 0) || [];

    const modToRow = (m: any) => `- [${m.mod.name}](https://nexusmods.com/${m.mod.game?.domainName}/mods/${m.mod.modId})`;

    const toEmbedField = (concerns: any[]): string => {
        if (!concerns.length) return '_None_';
        let result: string = '';
        for (const concern of concerns) {
            const row = modToRow(concern);
            const newString = `${result}\n${row}`;
            if (newString.length > 950) {
                const remaining = (concerns.length - concerns.indexOf(concern))
                return `${result}\n+${remaining} more`;
            }
            else result = newString;
        }
        return result;
    }

    const resultEmbed = new EmbedBuilder()
    .setTitle('Automod report')
    .addFields(
        [
            {
                name: `High Risk Mods (${highConcern.length})`,
                value: toEmbedField(highConcern)
            },
            {
                name: `Low Risk Mods (${lowConcern.length})`,
                value: toEmbedField(lowConcern)
            },
            {
                name: `Safe Mods (${noConcern.length})`,
                value: toEmbedField(noConcern)
            },

        ]
    )
    .setColor('DarkOrange')

    if (!process.env['DISCORD_WEBHOOK']) resultEmbed.addFields({ name: 'Missing Discord Webhook', value: 'Discord Webhook ENV variable is not present.' })
    else if (!process.env['SLACK_WEBHOOK']) resultEmbed.addFields({ name: 'Missing Slack Webhook', value: 'Slack Webhook ENV variable is not present.' })
    else resultEmbed.addFields({ name: 'Webhooks set up', value: 'All required webhooks are configured.' })

    return interaction.editReply({ embeds: [resultEmbed] })
}

export { discordInteraction }