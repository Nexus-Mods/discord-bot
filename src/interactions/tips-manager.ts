import { 
    CommandInteraction, ActionRowBuilder, Client, ButtonBuilder, 
    EmbedBuilder, Message, ButtonInteraction, ChatInputCommandInteraction, 
    ButtonStyle, ComponentType, SlashCommandBuilder, TextInputBuilder, TextInputStyle, 
    ModalActionRowComponentBuilder, ModalBuilder, EmbedData, MessageFlags, 
    ModalSubmitInteraction,
    CacheType,
    InteractionReplyOptions,
    AutocompleteInteraction,
    InteractionEditReplyOptions,
    PermissionFlagsBits
} from "discord.js";
import { InfoResult, PostableInfo, TipCache } from "../types/util";
import { ClientExt, DiscordInteraction } from '../types/DiscordTypes';
import { addTip, getAllTips, editTip } from '../api/bot-db';
import { logMessage } from "../api/util";
import { deleteTip, ITip, setApprovedTip } from "../api/tips";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setName('tips-manager')
    .setDescription('Manage tips.')
    .addSubcommand(sc =>
        sc.setName('add')
        .setDescription('Add a new tip')
    )
    .addSubcommand(sc =>
        sc.setName('edit')
        .setDescription('Add an existing tip')
        .addStringOption(option =>
            option.setName('prompt')
            .setDescription('The prompt of the tip to edit')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sc =>
        sc.setName('approve')
        .setDescription('Approve pending tips')
    ) as SlashCommandBuilder,
    public: false,
    guilds: [
        '581095546291355649',
        '1134149061080002713'
    ],
    action,
    autocomplete
}

type SubCommandType = 'add' | 'edit' | 'approve' | 'delete';

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const subCommand: SubCommandType = interaction.options.getSubcommand(true) as SubCommandType;

    const tips: ITip[] = await getAllTips().catch(() => []);

    switch(subCommand) {
        case 'add' : return addNewTip(client, interaction, tips);
        case 'edit': return editExistingTip(client, interaction, tips);
        case 'approve': return reviewTipsPendingApproval(client, interaction, tips);
        default: return interaction.editReply('Error!');
    }
}

const yesNoButtons: ActionRowBuilder<ButtonBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
        new ButtonBuilder({
            label: `Save Tip`,
            style: ButtonStyle.Primary,
            customId: 'confirm'
        }),
        new ButtonBuilder({
            label: 'Cancel',
            style: ButtonStyle.Secondary,
            customId: 'cancel'
        })
    )
];

const approvalButtons: ActionRowBuilder<ButtonBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
        new ButtonBuilder({
            label: `✅ Approve Tip`,
            style: ButtonStyle.Primary,
            customId: 'approve'
        }),
        new ButtonBuilder({
            label: '▶️ Skip',
            style: ButtonStyle.Secondary,
            customId: 'skip'
        }),
        new ButtonBuilder({
            label: '🗑️ Delete',
            style: ButtonStyle.Danger,
            custom_id: 'delete'
        })
    )
];

async function addNewTip(client: Client, interaction: ChatInputCommandInteraction, tips: ITip[]) {   

    await interaction.showModal(tipModal());
    const submit = await interaction.awaitModalSubmit({ time: 90_000 });

    const newPrompt = submit.fields.getTextInputValue('prompt-input');

    const existingTip: ITip | undefined = tips.find(t => t.prompt.toLowerCase() === newPrompt.toLowerCase())

    if (existingTip) return submit.reply(`The prompt ${newPrompt} is already assigned to another tip (${existingTip.title}).`);

    let newEmbed: EmbedBuilder | null = null;
    let newMessage: string | undefined = undefined;
    let temp: {tip: Partial<ITip>, embedData?: EmbedData};
    
    try {
        temp = validateModalResponse(submit);
        if (temp.embedData) {
            newEmbed = new EmbedBuilder(temp.embedData)
            .setFooter({ text:`Info added by ${interaction.user.displayName || '???'}`, iconURL: client.user?.avatarURL() || '' } )
            .setTimestamp(new Date())
            .setColor(0xda8e35);
        }
        if (temp.tip.message) newMessage = temp.tip.message;

    }
    catch(err) {
        return submit.reply({ content: 'Error creating tip - '+(err as Error)?.message, embeds: [] });
    }
    
    const exampleReplyPayload: InteractionReplyOptions = { embeds: [], flags: MessageFlags.Ephemeral };
    if (newMessage) exampleReplyPayload.content = newMessage;
    if (newEmbed) exampleReplyPayload.embeds = [newEmbed];
    await submit.reply(exampleReplyPayload);

    const message: Message = await interaction.followUp({ content: `# Save this tip shown above with title "${temp.tip.title}"? \n-# Prompt: ${temp.tip.prompt}`, components: yesNoButtons });
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
    collector.on('collect', async (i: ButtonInteraction) => {
        collector.stop(); 
        if (i.customId === 'confirm') {
            try {
                await i.deferUpdate();
                const confirm = await addTip(newPrompt, interaction.user.displayName, temp.tip.title!, JSON.stringify(temp.embedData), newMessage);
                await message.edit({ content: `Tip created. Prompt: ${confirm.prompt} ID: ${confirm.id}\n-# Use \`/tips prompt:${newPrompt}\` to view it.`, embeds: [] });
            }
            catch(err) {
                await message.edit({ content: 'Failed to insert new tip: '+(err as Error).message })
            }
        };
    })
    collector.on('end', () => { message.edit({ components: [] }).catch(e => logMessage('Error ending collector', e, true)) });
}

async function editExistingTip(client: Client, interaction: ChatInputCommandInteraction, tips: ITip[]) {
    const prompt: string = interaction.options.getString('prompt', true);
    const existingTip = tips.find(t => t.prompt === prompt.toLowerCase());
    if (!existingTip) return interaction.reply(`No tip found for ${prompt}.`);

    let newEmbed: EmbedBuilder | null = null;
    let newMessage: string | undefined = undefined;
    let temp: {tip: Partial<ITip>, embedData?: EmbedData};

    await interaction.showModal(tipModal(existingTip));
    const submit = await interaction.awaitModalSubmit({ time: 90_000 });
    
    try {
        temp = validateModalResponse(submit);
        if (temp.embedData) {
            newEmbed = new EmbedBuilder(temp.embedData)
            .setFooter({ text:`Info added by ${interaction.user.displayName || '???'}`, iconURL: client.user?.avatarURL() || '' } )
            .setTimestamp(new Date())
            .setColor(0xda8e35);
        }
        newMessage = temp.tip.message ?? undefined;

    }
    catch(err) {
        return submit.reply({ content: 'Error updating tip - '+(err as Error)?.message, embeds: [] });
    }

    const exampleReplyPayload: InteractionReplyOptions = { embeds: [], flags: MessageFlags.Ephemeral };
    if (newMessage) exampleReplyPayload.content = newMessage;
    if (newEmbed) exampleReplyPayload.embeds = [newEmbed];
    await submit.reply(exampleReplyPayload);
    
    const message: Message = await interaction.followUp({ content: `# Save this tip shown above with title "${temp.tip.title}"? \n-# Prompt: ${temp.tip.prompt}`, components: yesNoButtons });
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
    collector.on('collect', async (i: ButtonInteraction) => {
        collector.stop(); 
        if (i.customId === 'confirm') {
            try {
                await i.deferUpdate();
                await editTip(prompt, interaction.user.displayName, temp.tip.title!, JSON.stringify(temp.embedData), newMessage);
                await message.edit({ content: `Tip updated. Prompt: ${prompt} ID: ${existingTip.id}\n-# Use \`/tips prompt:${prompt}\` to view it.`, embeds: [] });
            }
            catch(err) {
                await message.edit({ content: 'Failed to update tip: '+(err as Error).message })
            }
        };
    })
    collector.on('end', () => { message.edit({ components: [] }).catch(e => logMessage('Error ending collector', e, true)) });
}

async function reviewTipsPendingApproval(client: ClientExt, interaction: ChatInputCommandInteraction, tips: ITip[]) {
    await interaction.deferReply();

    if (!client.tipCache) client.tipCache = new TipCache();
    const unapprovedTips = await client.tipCache?.getPendingTips();
    logMessage("Tips to approve "+unapprovedTips.length);

    if (!unapprovedTips.length) return interaction.editReply("No tips to approve");  

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({componentType: ComponentType.Button, time: 120000});
    collector.on('end', () => { interaction.editReply({ components: [] }).catch(e => logMessage('Error ending collector', e, true)) });

    for (const tip of unapprovedTips) {
        if (collector.ended) break;  
        logMessage('Displaying Tip', { prompt: tip.prompt, title: tip.title });
        const postable: InteractionEditReplyOptions = { components: approvalButtons };

        if (tip.embed) {
            postable.embeds = [
                new EmbedBuilder(JSON.parse(tip.embed) as EmbedData)
                .setFooter({ text:`Info added by ${tip.author || '???'}`, iconURL: client.user?.avatarURL() || '' } )
                .setTimestamp(new Date())
                .setColor(0xda8e35)
            ];
        }
        if (tip.message) postable.content = `${tip.message}\n-# Title: ${tip.title} | Prompt: ${tip.prompt}`;
        else postable.content = `-# Title: ${tip.title} | Prompt: ${tip.prompt}`;

        await interaction.editReply(postable);

        const collectPromise = new Promise((resolve, reject) => {

            collector.once('collect', async (i: ButtonInteraction) => { 
                logMessage('Button press', { customId: i.customId });
                try {
                    await i.deferUpdate();
                    switch (i.customId) {
                        case 'approve': return resolve(await setApprovedTip(tip.prompt, true).catch(e => logMessage(e, true)));
                        case 'skip': return resolve(null);
                        case 'delete': return resolve(await deleteTip(tip.prompt).catch(e => logMessage(e, true)));
                        default: reject('Unrecognised button interaction '+i.customId);
                    }
                }
                catch(err) {
                    logMessage('Error with ButtonInteraction', err, true);
                }
            });
        });

        try {
            await collectPromise;
        }
        catch(err) {
            logMessage('Failed to process collectPromise', err, true);
        }

        continue;
    }

    if (!collector.ended) collector.stop();
    await interaction.editReply({ content: 'All tips reviewed', embeds:[], components: [] }).catch(e => logMessage("Failed to finish tip review", e, true));

}

function tipModal(existingTip?: ITip): ModalBuilder {
    const promptInput = new TextInputBuilder()
    .setCustomId('prompt-input')
    .setLabel('Prompt')
    .setPlaceholder('e.g. dlhelp')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(60);
    if (existingTip?.prompt) promptInput.setValue(existingTip.prompt);

    const titleInput = new TextInputBuilder()
    .setCustomId('title-input')
    .setLabel('Title')
    .setPlaceholder('e.g. Download Help')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(120);
    if (existingTip?.title) titleInput.setValue(existingTip.title);

    const messageInput = new TextInputBuilder()
    .setCustomId('message-input')
    .setLabel('Message to send (non-embed)')
    .setPlaceholder('e.g. Download Help')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(3000)
    if (existingTip?.message) messageInput.setValue(existingTip.message);

    const jsonInput = new TextInputBuilder()
    .setCustomId('json-input')
    .setLabel('Embed JSON Input - Tip: Use an online editor!')
    .setPlaceholder('')
    .setRequired(false)
    .setStyle(TextInputStyle.Paragraph);
    if (existingTip?.embed) jsonInput.setValue(existingTip.embed);

    const row1 = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(promptInput);

    const row2 = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(titleInput);

    const row3 = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(jsonInput);

    const row4 = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(messageInput);

    const modal = new ModalBuilder()
    .setTitle('Add a new tip')
    .setCustomId('tip-edit-modal')
    .addComponents(row1, row2, row3, row4);

    return modal;
}

function validateModalResponse(submit: ModalSubmitInteraction<CacheType>): {tip: Partial<ITip>, embedData?: EmbedData} {
    const prompt = submit.fields.getTextInputValue('prompt-input');
    const title = submit.fields.getTextInputValue('title-input');
    const message = submit.fields.getTextInputValue('message-input');
    const json = submit.fields.getTextInputValue('json-input');

    if (!message && !json) throw new Error('A message or embed JSON must be provided!');

    let embed: EmbedData | undefined = undefined;

    if (json?.length) {
        try {
            embed = JSON.parse(json) as EmbedData;
            // Apply overrides
            delete embed.footer;
            delete embed.timestamp;
            delete embed.color;
        }
        catch {
            logMessage('Invalid JSON submitted');
            throw new Error('Invalid JSON for embed')
        }
    }

    return { 
        tip: 
        {
            prompt,
            title,
            message,
            embed: json?.length ? JSON.stringify(embed) : null,
        },
        embedData: embed,
    }
    
}

async function autocomplete(client: ClientExt, interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase();
    try {
        if (!client.tipCache) client.tipCache = new TipCache();
        const tips = await client.tipCache.getTips();
        const filtered = tips.filter(t => focused === '' || t.prompt.toLowerCase().includes(focused) || t.title.toLowerCase().includes(focused) );
        await interaction.respond(
            filtered.map(t => ({ name: t.title, value: t.prompt })).slice(0, 25)
        );
    }
    catch(err) {
        logMessage('Error autocompleting tips', {err}, true);
        throw err;
    }
}

export { discordInteraction };