import { ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { logMessage } from "../api/util";
import { createAutomodRule, deleteAutomodRule } from "../api/bot-db";
import { IAutomodRule } from "../types/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Automatic Moderator Command.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sc =>
        sc.setName('report')
        .setDescription('See the last few mods checked by the automod.')
    )
    .addSubcommandGroup(sgc => 
        sgc.setName('rules')
        .setDescription('Manage Automod rules.')
        .addSubcommand(sc => 
            sc.setName('add')
            .setDescription('Add a new filter to the Automod.')
            .addStringOption(o => 
                o.setName('level')
                .setDescription('Level of trigger. High priority triggers alert moderators.')
                .setRequired(true)
                .setChoices([{ name: 'High', value: 'high' }, { name: 'Low', value: 'low' }])
            )
            .addStringOption(o =>
                o.setName('filter')
                .setDescription('The phase to look for in mods.')
                .setRequired(true)
            )
            .addStringOption(o =>
                o.setName('note')
                .setDescription('The note to show on the mod report.')
                .setRequired(true)
                .setMinLength(5)
            )
        )
        .addSubcommand(sc =>
            sc.setName('list')
            .setDescription('List existing Automod rules.')
        )
        .addSubcommand(sc =>
            sc.setName('remove')
            .setDescription('Remove a filter from the Automod.')
            .addIntegerOption(o =>
                o.setName('id')
                .setDescription('The rule ID to delete.')
                .setMinValue(1)
                .setRequired(true)
            )
        )
    ) as SlashCommandBuilder,
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

    // Get Subgroup and group
    const commandGroup = interaction.options.getSubcommandGroup();
    const command = interaction.options.getSubcommand(true);

    // Handle command
    if (commandGroup === 'rules') {
        switch (command) {
            case 'add': return addRule(client, interaction);
            case 'list': return listRules(client, interaction);
            case 'remove': return removeRule(client, interaction);
            default: throw new Error('Subcommand not implemented: '+command)
        }
    }
    else if (commandGroup === null && command === 'report') return showReport(client, interaction);
    else throw new Error(`Unrecognised command - Group: ${commandGroup} Command: ${command}`);
}

async function addRule(client: ClientExt, interaction: ChatInputCommandInteraction): Promise<any> {
    // Get the options passed to the command
    const level: 'low' | 'high' = interaction.options.getString('level', true) as 'low' | 'high';
    const filter: string = interaction.options.getString('filter', true);
    const note: string = interaction.options.getString('note', true);
    let id = -1 // Update this once created.

    logMessage('Adding automod rule', { level, filter, note });

    try {
        id = await createAutomodRule(level, filter, note);
        logMessage('Added new rule with ID', id);
    }
    catch(err) {
        logMessage('Failed to add automod rule', err);
        throw new Error('Failed to create rule: '+(err as Error).message)
    }

    const success = new EmbedBuilder()
    .setTitle('Rule Created')
    .setDescription(`**ID:** ${id}\n**Level:** ${level.toUpperCase()}\n**Filter:** ${filter}\n**Note:** ${note}`)
    .setThumbnail(client.user?.avatarURL() || '')
    .setColor(0xda8e35);

    client.automod?.clearRuleCache();

    return interaction.editReply({ content: null, embeds: [success] });
}

async function listRules(client: ClientExt, interaction: ChatInputCommandInteraction): Promise<any> {
    const rules = await client.automod?.retrieveRules() ?? [];

    // Cut up the array into pages for Discord's character limit.
    const rulePages = new Array<IAutomodRule[]>()
    let currentPage = [];

    for (const rule of rules) {
        console.log('Handling rule', rule.filter)
        currentPage.push(rule);
        if (currentPage.length === 15) {
            rulePages.push([...currentPage]);
            currentPage = [];
        }
    }

    rulePages.push(currentPage);
    // End pagination.

    const header = `| ID | Type | Filter | Added | Note |\n`
    +`| --- | --- | --- | --- | --- |\n`

    const body = rulePages[0].map(r => `| ${r.id} | ${r.type} | ${r.filter} | ${r.added.toLocaleString()} | ${r.reason} `);

    const messageText = header+body.join('\n');

    await interaction.editReply(`# Automod Rules\n\`\`\`${messageText}\`\`\``);

    if (rulePages.length > 1) {
        // Post extra pages
        rulePages.map(async (page, index) => {
            if (index === 0) return;
            const pageMessage = `\`\`\`${header}${page.map(r => `| ${r.id} | ${r.type} | ${r.filter} | ${r.added.toLocaleString()} | ${r.reason} `).join('\n')}\`\`\``;
            await interaction.followUp({content: pageMessage, ephemeral: true});
            return;
        });
    }

}

async function removeRule(client: ClientExt, interaction: ChatInputCommandInteraction): Promise<any> {
    const id: number = interaction.options.getInteger('id', true);

    const rules = await client.automod?.retrieveRules() ?? [];

    const ruleToRemove = rules.find(r => r.id == id);
    logMessage("Attempting to delete automod rule", { id , ruleToRemove, rules });

    if (!ruleToRemove) {
        return interaction.editReply('Nothing to delete. No rule with ID '+id)
    }

    try {
        await deleteAutomodRule(id);
    }
    catch(err) {
        throw new Error('Failed to delete automod rule: '+(err as Error).message);
    }

    client.automod?.clearRuleCache();
    return interaction.editReply({ content: `Rule Deleted\n\`\`\`${JSON.stringify(ruleToRemove, null, 2)}\`\`\``})
}

async function showReport(client: ClientExt, interaction: ChatInputCommandInteraction): Promise<any> {
    const report = client.automod?.lastReports
    const reportsMerged = report?.reduce((prev, cur) => {
        if (cur.length) prev = [...prev, ...cur];
        return prev;
    }, [])
    logMessage('Generating automod report', { reportCount: reportsMerged?.length });

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