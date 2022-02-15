import { CommandInteraction, MessageActionRow, Client, MessageButton, Interaction, MessageEmbed, Message, ButtonInteraction, EmbedFieldData } from "discord.js";
import { DiscordInteraction, InfoResult, PostableInfo } from "../types/util";
import { getAllInfos, displayInfo, createInfo } from '../api/bot-db';
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'tips-manager',
        description: 'Manage tips.',
        options: [
            {
                name: 'create',
                type: 'SUB_COMMAND',
                description: 'Add a new tip by pasting in JSON data',
                options: [
                    {
                        name: 'code',
                        type: 'STRING',
                        description: 'The short code to load this tip.',
                        required: true,
                    },
                    {
                        name: 'json',
                        type: 'STRING',
                        description: 'The JSON data to use, must be a single line.',
                        required: true,                        
                    }                    
                ]
            },
            {
                name: 'update',
                type: 'SUB_COMMAND',
                description: 'Update an existing tip with new JSON',
                options: [
                    {
                        name: 'code',
                        type: 'STRING',
                        description: 'The short code of the tip to update.',
                        required: true,
                    },
                    {
                        name: 'json',
                        type: 'STRING',
                        description: 'The JSON data to use, must be a single line.',
                        required: true,                        
                    }   
                ]
            },
            {
                name: 'tojson',
                type: 'SUB_COMMAND',
                description: 'Show the tip as JSON',
                options: [
                    {
                        name: 'code',
                        type: 'STRING',
                        description: 'The tip to load.'
                    }
                ]
            }
        ]
    },
    public: false,
    guilds: [
        '581095546291355649'
    ],
    action
}

type SubCommandType = 'tojson' | 'create' | 'update';

async function action(client: Client, baseinteraction: Interaction): Promise<any> {
    const interaction = baseinteraction as CommandInteraction
    const subCommand: SubCommandType = interaction.options.getSubcommand(true) as SubCommandType;

    await interaction.deferReply({ ephemeral: true });

    const infos: InfoResult[] = await getAllInfos().catch(() => []);

    switch(subCommand) {
        case 'tojson': return tipJSON(client, interaction, infos);
        case 'create': return createTip(client, interaction, infos);
        case 'update': return updateTip(client, interaction, infos);
        default: return interaction.editReply('Error!');
    }
}

async function tipJSON(client: Client, interaction: CommandInteraction, infos: InfoResult[]) {   
    const code: string = interaction.options.getString('code', true);

    const tipToShow: InfoResult|undefined = infos.find(i => i.name === code.toLowerCase());
    if (!tipToShow) return interaction.editReply('Unknown tip code.');
    const postable: PostableInfo = displayInfo(client, tipToShow);
    const output = {...postable, embeds: postable.embeds?.map(m => m.toJSON()) };
    const jsonContent = JSON.stringify(output, null, 2);
    if (jsonContent.length > 2000) {
        return interaction.editReply({ files: [ { name: `code.json`, file: jsonContent } ] })
    }
    else return interaction.editReply({ content: `\`\`\`json\n${JSON.stringify(output, null, 2)}\`\`\``, embeds: output.embeds, });
}

async function createTip(client: Client, interaction: CommandInteraction, infos: InfoResult[]) {
    const userJson: string = interaction.options.getString('json', true);
    const name: string = interaction.options.getString('code', true);

    const components: MessageActionRow[] = [
        new MessageActionRow()
        .addComponents(
            new MessageButton({
                label: `Add ${name}`,
                style: 'PRIMARY',
                customId: 'confirm'
            }),
            new MessageButton({
                label: 'Cancel',
                style: 'SECONDARY',
                customId: 'cancel'
            })
        )
    ];

    try {
        const messageContent = JSON.parse(userJson);
        const content = messageContent && messageContent.content.length ? messageContent.content : null;
        const embeds = messageContent.embed ? [new MessageEmbed(messageContent.embed)] : [];
        const message: Message = await interaction.fetchReply() as Message;
        await interaction.editReply({ content, embeds, components });
        const collector = message.createMessageComponentCollector({ componentType: 'BUTTON', time: 30000 });
        collector.on('collect', async (i: ButtonInteraction) => {
            collector.stop(); 
            if (i.customId === 'confirm') {
                try {
                    await i.deferUpdate();
                    const infoToStore = covertToInfoResult(name, content, messageContent.embed);
                    await createInfo(infoToStore);
                    await interaction.editReply({ content: 'Info created' });
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
    const author: string = (embed?.footer?.text as string).substring(embed.footer.text.indexOf('by ') + 3) || 'Nexus Mods';

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