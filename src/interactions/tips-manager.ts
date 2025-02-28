import { CommandInteraction, ActionRowBuilder, Client, ButtonBuilder, Interaction, EmbedBuilder, Message, ButtonInteraction, ChatInputCommandInteraction, ButtonStyle, ComponentType, SlashCommandBuilder, TextInputBuilder, TextInputStyle, ModalActionRowComponentBuilder, ModalBuilder, EmbedData } from "discord.js";
import { InfoResult, PostableInfo } from "../types/util";
import { DiscordInteraction } from '../types/DiscordTypes';
import { getAllInfos, displayInfo, createInfo, addTip } from '../api/bot-db';
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('tips-manager')
    .setDescription('Manage tips.')
    .addSubcommand(sc =>
        sc.setName('create')
        .setDescription('Add a new tip by pasting in JSON data')
        .addStringOption(option => 
            option.setName('code')
            .setDescription('The short code to load this tip.')    
            .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('json')
            .setDescription('The JSON data to use, must be a single line.')
            .setRequired(true)
        )
    )
    .addSubcommand(sc =>
        sc.setName('add')
        .setDescription('Add a new tip using a JSON block (BETA)')
    )
    .addSubcommand(sc =>
        sc.setName('update')
        .setDescription('Update an existing tip with new JSON.')
        .addStringOption(option => 
            option.setName('code')
            .setDescription('The short code to load this tip.')    
            .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('json')
            .setDescription('The JSON data to use, must be a single line.')
            .setRequired(true)
        )
    )
    .addSubcommand(sc =>
        sc.setName('tojson')
        .setDescription('Show the tip as JSON')
        .addStringOption(option => 
            option.setName('code')
            .setDescription('The short code to load this tip.')    
            .setRequired(true)
        )
    ) as SlashCommandBuilder,
    public: false,
    guilds: [
        '581095546291355649'
    ],
    action
}

type SubCommandType = 'tojson' | 'create' | 'update' | 'add';

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const subCommand: SubCommandType = interaction.options.getSubcommand(true) as SubCommandType;

    await interaction.deferReply({ ephemeral: true });

    const infos: InfoResult[] = await getAllInfos().catch(() => []);

    switch(subCommand) {
        case 'add' : return addNewTip(client, interaction, infos);
        case 'tojson': return tipJSON(client, interaction, infos);
        case 'create': return createTip(interaction);
        case 'update': return updateTip(client, interaction, infos);
        default: return interaction.editReply('Error!');
    }
}

async function addNewTip(client: Client, interaction: ChatInputCommandInteraction, infos: InfoResult[]) {   
    const nameInput = new TextInputBuilder()
    .setCustomId('name-input')
    .setLabel('Short Code')
    .setPlaceholder('e.g. downloadhelp')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(60);

    const titleInput = new TextInputBuilder()
    .setCustomId('title-input')
    .setLabel('Title Code')
    .setPlaceholder('e.g. Download Help')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(120);

    const messageInput = new TextInputBuilder()
    .setCustomId('message-input')
    .setLabel('Message to send (non-embed)')
    .setPlaceholder('e.g. Download Help')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(120);

    const jsonInput = new TextInputBuilder()
    .setCustomId('json-input')
    .setLabel('Embed JSON Input - Tip: Use an online editor!')
    .setPlaceholder('')
    .setStyle(TextInputStyle.Paragraph);

    const row1 = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(nameInput, titleInput);

    const row2 = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(jsonInput, messageInput);

    const modal = new ModalBuilder()
    .setTitle('Add a new tip')
    .setCustomId('tip-edit-modal')
    .addComponents(row1, row2)

    await interaction.showModal(modal);
    const submit = await interaction.awaitModalSubmit({ time: 60_000 });
    await submit.deferReply();
    const newTitle = submit.fields.getTextInputValue('title-input');
    const newName = submit.fields.getTextInputValue('name-input');
    const newMesage = submit.fields.getTextInputValue('message-input');
    const newJson = submit.fields.getTextInputValue('json-input');

    let embedJSON: EmbedData | undefined = undefined;
    let newEmbed: EmbedBuilder | undefined = undefined;

    if (newJson?.length) {
        try {
            embedJSON = JSON.parse(newJson) as EmbedData;
            delete embedJSON.footer;
            delete embedJSON.timestamp;
            delete embedJSON.color;
            newEmbed = new EmbedBuilder(embedJSON);
            // Apply overrides
            delete embedJSON.footer;
            delete embedJSON.timestamp;
            delete embedJSON.color;
            newEmbed.setFooter({ text:`Info added by ${interaction.user.displayName || '???'}`, iconURL: client.user?.avatarURL() || '' } )
            .setTimestamp(new Date())
            .setColor(0xda8e35);
        }
        catch {
            logMessage('Invalid JSON submitted');
            return interaction.editReply({ content: 'Error - Invalid JSON for embed', embeds: [] });
        }
    }

    await interaction.editReply({ content: newMesage ?? null, embeds: newEmbed ? [ newEmbed ] : [] });

    const yesNoButtons: ActionRowBuilder<ButtonBuilder>[] = [
        new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder({
                label: `Add ${name}`,
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

    const message: Message = await interaction.followUp({ content: `Save this embed? \n Title: ${newTitle}, Code: ${newName}`, components: yesNoButtons });
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
    collector.on('collect', async (i: ButtonInteraction) => {
        collector.stop(); 
        if (i.customId === 'confirm') {
            try {
                await i.deferUpdate();
                const id = await addTip(newName, interaction.user.displayName, newTitle, JSON.stringify(embedJSON), newMesage)
                await message.edit({ content: `Info created: ${newName} ID:  ${id}` });
            }
            catch(err) {
                await message.edit({ content: 'Failed to insert new tip: '+(err as Error).message })
            }
        };
    })
    collector.on('end', () => { message.edit({ components: [] }).catch(e => logMessage('Error ending collector', e, true)) });
}

async function tipJSON(client: Client, interaction: ChatInputCommandInteraction, infos: InfoResult[]) {   
    const code: string = interaction.options.getString('code', true);

    const tipToShow: InfoResult|undefined = infos.find(i => i.name === code.toLowerCase());
    if (!tipToShow) return interaction.editReply('Unknown tip code.');
    const postable: PostableInfo = displayInfo(client, tipToShow, null);
    const output = {...postable, embeds: postable.embeds?.map(m => m.toJSON()) };
    const jsonContent = JSON.stringify(output, null, 2);
    if (jsonContent.length > 2000) {
        return interaction.editReply({ files: [ { name: `code.json`,  attachment: jsonContent } ] });
    }
    else return interaction.editReply({ content: `\`\`\`json\n${JSON.stringify(output, null, 2)}\`\`\``, embeds: output.embeds, });
}

async function createTip(interaction: ChatInputCommandInteraction) {
    const userJson: string = interaction.options.getString('json', true);
    const name: string = interaction.options.getString('code', true);

    const components: ActionRowBuilder<ButtonBuilder>[] = [
        new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder({
                label: `Add ${name}`,
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

    try {
        const messageContent = JSON.parse(userJson);
        const content = messageContent.content && messageContent.content.length ? messageContent.content : null;
        const embeds = messageContent.embed ? [new EmbedBuilder(messageContent.embed)] : [];
        const message: Message = await interaction.fetchReply() as Message;
        await interaction.editReply({ content, embeds, components });
        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });
        collector.on('collect', async (i: ButtonInteraction) => {
            collector.stop(); 
            if (i.customId === 'confirm') {
                try {
                    await i.deferUpdate();
                    const infoToStore = covertToInfoResult(name, content, messageContent.embed);
                    await createInfo(infoToStore);
                    await interaction.editReply({ content: `Info created: ${name}` });
                }
                catch(err) {
                    await interaction.editReply({ content: 'Failed to insert new tip: '+(err as Error).message })
                }
            };
        })
        collector.on('end', () => { interaction.editReply({ components: [] }).catch(e => logMessage('Error ending collector', e, true)) });

    }
    catch(err) {
        return interaction.editReply(`Error parsing JSON: ${(err as Error).message}`);
    }
}

function covertToInfoResult(name: string, message: string|null, embed: any): InfoResult {
    const author: string = (embed?.footer?.text as string)?.substring(embed.footer.text.indexOf('by ') + 3) || 'Nexus Mods';

    const checkValue = (input: string|undefined|null) => !!input ? input : undefined;

    return {
        name,
        message: checkValue(message),
        title: checkValue(embed?.title),
        description: checkValue(embed?.description),
        url: checkValue(embed?.url),
        thumbnail: checkValue(embed?.thumbnail?.url),
        image: checkValue(embed?.image),
        fields: embed?.fields,
        approved: true,
        author
    }
}

async function updateTip(client: Client, interaction: CommandInteraction, infos: InfoResult[]) {
    return interaction.editReply('Work in progress!');    
}

export { discordInteraction };