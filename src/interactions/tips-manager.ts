import { 
    CommandInteraction, ActionRowBuilder, Client, ButtonBuilder, 
    EmbedBuilder, Message, ButtonInteraction, ChatInputCommandInteraction, 
    ButtonStyle, ComponentType, SlashCommandBuilder, TextInputBuilder, TextInputStyle, 
    ModalActionRowComponentBuilder, ModalBuilder, EmbedData, MessageFlags, 
    ModalSubmitInteraction,
    CacheType,
    InteractionReplyOptions
} from "discord.js";
import { InfoResult, PostableInfo } from "../types/util";
import { DiscordInteraction } from '../types/DiscordTypes';
import { addTip, getAllTips, editTip } from '../api/bot-db';
import { logMessage } from "../api/util";
import { ITip } from "../api/tips";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
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
        )
    ) as SlashCommandBuilder,
    public: false,
    guilds: [
        '581095546291355649'
    ],
    action
}

type SubCommandType = 'add' | 'edit' | 'approve' | 'delete';

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const subCommand: SubCommandType = interaction.options.getSubcommand(true) as SubCommandType;

    const tips: ITip[] = await getAllTips().catch(() => []);

    switch(subCommand) {
        case 'add' : return addNewTip(client, interaction, tips);
        case 'edit': return editExistingTip(client, interaction, tips);
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

async function addNewTip(client: Client, interaction: ChatInputCommandInteraction, tips: ITip[]) {   

    await interaction.showModal(tipModal());
    const submit = await interaction.awaitModalSubmit({ time: 90_000 });

    const newPrompt = submit.fields.getTextInputValue('prompt-input');

    const existingTip: ITip | undefined = tips.find(t => t.prompt.toLowerCase() === newPrompt.toLowerCase())

    if (existingTip) return submit.reply(`The prompt ${prompt} is already assigned to another tip (${existingTip.title}).`);

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
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(120);
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

export { discordInteraction };