import { 
    CommandInteraction, MessageActionRow, MessageSelectMenu, Client, MessageSelectOptionData, MessageEmbed, 
    Message, InteractionCollector, MessageButton, Interaction, User 
} from "discord.js";
import { DiscordInteraction, InfoResult, PostableInfo } from "../types/util";
import { getAllInfos, displayInfo } from '../api/bot-db';
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'tips',
        description: 'Return a quick info message on a number of topics.',
        options: [
            {
                name: 'code',
                type: 'STRING',
                description: 'Quick code for known message. (Optional)',
                required: false,
            },
            {
                name: 'user',
                type: 'USER',
                description: 'The user to ping in the reply. (Optional)'
            }
        ]
    },
    public: true,
    guilds: [],
    action
}

async function action(client: Client, baseinteraction: Interaction): Promise<any> {
    const interaction = (baseinteraction as CommandInteraction);
    await interaction.deferReply({ ephemeral: true }).catch(err => { throw err });
    
    const message: string | null = interaction.options.getString('code');
    const user: User | null = interaction.options.getUser('user');

    const data: InfoResult[] = await getAllInfos().catch(() => []);
    let content: string | null = null;

    if (!data.length) return interaction.editReply('No infos available.');

    if (!!message) {
        const selected: InfoResult|undefined = data.find(i => i.name.toLowerCase() === message.toLowerCase());
        if (!!selected) {
            await interaction.editReply({ content: 'Info posted!', embeds: [], components: [] });
            return displaySelected(client, selected, interaction, user);
        }
        else content = `No results found for ${message}`;
    }

    if (!interaction.guild) return interaction.editReply('Unrecognised or invalid code.');

    try {
    const options: MessageSelectOptionData[] = data.sort((a,b) => (a.title || a.name).localeCompare(b.title || b.name)).map(d => ({
        label: d.title || d.name,
        description: `Short code: ${d.name}`,
        value: d.name
    }));
    
    // No message pre-selected!
    const choices: MessageActionRow[] | undefined = 
        data.length ? [
            new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                .setCustomId('info-select')
                .setPlaceholder('Select a topic to display...')
                .addOptions(options)
            ),
            new MessageActionRow()
            .addComponents(
                new MessageButton()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle('SECONDARY')
            )
        ] : undefined;

    const searchEmbed: MessageEmbed = new MessageEmbed()
    .setColor(0xda8e35)
    .setTitle('Select an Info Message to display')
    .setDescription('This command will return an embed or message based on a preset help topic. Select the desired topic below.')
    .addField('Suggest Tips', 'You can suggest your own tips to be shown with this command [here](https://forms.gle/jXzqwr5caRiSPZRf7).')
    .setFooter({text:`Nexus Mods API link`, iconURL:client.user?.avatarURL() || ''});


    const replyMsg = await interaction.editReply({ content, embeds: [searchEmbed], components: choices, });

    // Set up the collector
    const collector: InteractionCollector<any> = (replyMsg as Message).createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async s => {
        if (s.isButton() && s.customId === 'cancel') {
            collector.stop('Selection complete');
            await interaction.editReply({ content: 'Selection cancelled.', embeds: [], components: [] });
            return;
        }

        await s.deferUpdate();
        const selected = data.find(d => d.name === s.values[0]);
        if (!!selected) {
            collector.stop('Selection complete');
            await interaction.editReply({ content: 'Info posted!', embeds: [], components: [] });
            return displaySelected(client, selected, interaction, user)
        };
    });

    collector.on('end', async () => {
        await interaction.editReply({ components: [] }).catch((err) => logMessage('Error ending collector', err, true));
    });
    } 
    catch(err) {
        logMessage('Failed to show list of infos', { err }, true);
        interaction.editReply({ content: 'Something went wrong. Please try again later.' });
    }

}

async function displaySelected(client: Client, selected: InfoResult, interaction: CommandInteraction, user: User | null): Promise<any> {
    logMessage('Posting interaction', { selected: selected.name });
    const postable: PostableInfo = displayInfo(client, selected, user);
    return interaction.followUp(postable);
}

export { discordInteraction };