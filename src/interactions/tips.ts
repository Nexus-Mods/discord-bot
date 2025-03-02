import { 
    CommandInteraction, ActionRowBuilder, SelectMenuBuilder, Client, EmbedBuilder, 
    Message, InteractionCollector, ButtonBuilder, User, SlashCommandBuilder, 
    ChatInputCommandInteraction, ButtonStyle, SelectMenuOptionBuilder, 
    AutocompleteInteraction,
    EmbedData,
    InteractionReplyOptions
} from "discord.js";
import { InfoResult, PostableInfo } from "../types/util";
import { DiscordInteraction } from '../types/DiscordTypes';
import { getAllInfos, displayInfo, getAllTips } from '../api/bot-db';
import { logMessage } from "../api/util";
import { ITip } from "../api/tips";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('tips')
    .setDescription('Return a quick info message on a number of topics.')
    .addStringOption(option =>
        option.setName('code')
        .setDescription('Quick code for known message. (Optional)')
        .setRequired(false)
        .setAutocomplete(true)    
    )
    .addUserOption(option =>
        option.setName('user')
        .setDescription('The user to ping in the reply. (Optional)')
        .setRequired(false)    
    )
    .setDMPermission(true) as SlashCommandBuilder,
    public: true,
    guilds: [],
    action,
    autocomplete
}

class TipCache {
    private tips : ITip[] = [];
    private nextUpdate: number = new Date().getTime() + 300000;

    constructor() {
        getAllTips()
        .then( t =>  {
            this.tips = t;
            this.setNextUpdate();
        });
    }

    private setNextUpdate() {
        this.nextUpdate = new Date().getTime() + 300000
    }
    
    public async getApprovedTips() {
        return this.tips.filter(t => t.approved === true);
    }

    public async getTips(): Promise<ITip[]> {
        if (new Date().getTime() > this.nextUpdate) {
            this.tips = await getAllTips();
            this.setNextUpdate();
        }
        return this.tips;
    }
}

let tipCache: TipCache;

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ ephemeral: true }).catch(err => { throw err });
    
    const message: string | null = interaction.options.getString('code');
    const user: User | null = interaction.options.getUser('user');

    const data: InfoResult[] = await getAllInfos().catch(() => []);
    if (!tipCache) tipCache = new TipCache();
    const tips: ITip[] = await tipCache.getTips().catch(() => []);
    let content: string | null = null;

    if (!data.length && !tips.length) return interaction.editReply('No infos available.');

    if (!!message) {
        const selected: InfoResult|undefined = data.find(i => i.name.toLowerCase() === message.toLowerCase());
        const tip: ITip | undefined = tips.find(t => t.prompt.toLowerCase() === message.toLowerCase());
        if (!!selected) {
            await interaction.editReply({ content: 'Info posted!', embeds: [], components: [] });
            return displaySelected(client, selected, interaction, user);
        }
        else if (!!tip) {
            await interaction.editReply({ content: 'Tip posted!', embeds: [], components: [] });
            const postable: InteractionReplyOptions = { embeds: [] };
            if (tip.message) postable.content = tip.message;
            if (tip.embed) {
                const embedData = JSON.parse(tip.embed) as EmbedData;
                const embedToShow = new EmbedBuilder(embedData);
                postable.embeds = [ embedToShow ]
            }
            return interaction.followUp(postable);
        }
        else content = `No results found for ${message}`;
    }

    if (!interaction.guild) return interaction.editReply('Unrecognised or invalid code.');

    try {
    const options: SelectMenuOptionBuilder[] = data.sort((a,b) => (a.title || a.name).localeCompare(b.title || b.name))
    .map(d =>  new SelectMenuOptionBuilder()
        .setLabel(d.title || d.name)
        .setDescription(`Short code: ${d.name}`)
        .setValue(d.name)
    );
    
    // No message pre-selected!
    const choices: ActionRowBuilder<SelectMenuBuilder | ButtonBuilder>[] | undefined = 
        data.length ? [
            new ActionRowBuilder<SelectMenuBuilder>()
            .addComponents(
                new SelectMenuBuilder()
                .setCustomId('info-select')
                .setPlaceholder('Select a topic to display...')
                .addOptions(options)
            ),
            new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
            )
        ] : undefined;

    const searchEmbed: EmbedBuilder = new EmbedBuilder()
    .setColor(0xda8e35)
    .setTitle('Select an Info Message to display')
    .setDescription('This command will return an embed or message based on a preset help topic. Select the desired topic below.')
    .addFields({ name: 'Suggest Tips', value: 'You can suggest your own tips to be shown with this command [here](https://forms.gle/jXzqwr5caRiSPZRf7).'})
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

async function autocomplete(client: Client, interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused();
    try {
        const tips = await getAllTips();
        const filtered = tips.filter(t => focused === '' || t.prompt.toLowerCase().includes(focused.toLowerCase()) || t.title.toLowerCase().includes(focused.toLowerCase()) );
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