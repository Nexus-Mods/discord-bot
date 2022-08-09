import { CommandInteraction, ActionRowBuilder, Client, ButtonBuilder, Interaction, EmbedBuilder, Message, ButtonInteraction, ChatInputCommandInteraction, ButtonStyle, ComponentType, SlashCommandBuilder } from "discord.js";
import { InfoResult, PostableInfo } from "../types/util";
import { DiscordInteraction } from '../types/DiscordTypes';
import { getAllInfos, displayInfo, createInfo } from '../api/bot-db';
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

type SubCommandType = 'tojson' | 'create' | 'update';

async function action(client: Client, interaction: ChatInputCommandInteraction): Promise<any> {
    const subCommand: SubCommandType = interaction.options.getSubcommand(true) as SubCommandType;

    await interaction.deferReply({ ephemeral: true });

    const infos: InfoResult[] = await getAllInfos().catch(() => []);

    switch(subCommand) {
        case 'tojson': return tipJSON(client, interaction, infos);
        case 'create': return createTip(interaction);
        case 'update': return updateTip(client, interaction, infos);
        default: return interaction.editReply('Error!');
    }
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