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
        .setRequired(true)
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
    private nextUpdate: number = new Date().getTime() + 10000;

    constructor() {
        getAllTips()
        .then( t =>  {
            this.tips = t;
            this.setNextUpdate();
        });
    }

    private setNextUpdate(): void {
        this.nextUpdate = new Date().getTime() + 300000
    }

    private async fetchTips(limit?: 'approved' | 'unapproved'): Promise<ITip[]> {
        if (new Date().getTime() > this.nextUpdate) {
            logMessage("Recaching tips")
            this.tips = await getAllTips();
            this.setNextUpdate();
        }
        else logMessage("Using cached tips "+new Date(this.nextUpdate).toLocaleDateString());
        switch(limit){
            case 'approved' : return this.tips.filter(t => t.approved === true);
            case 'unapproved' : return this.tips.filter(t => t.approved === true);
            default: return this.tips;
        }
    }
    
    public async getApprovedTips(): Promise<ITip[]> {
        return await this.fetchTips('approved');
    }

    public async getPendingTips(): Promise<ITip[]> {
        return await this.fetchTips('unapproved');
    }

    public async getTips(): Promise<ITip[]> {
        return await this.fetchTips();
    }
}

let tipCache: TipCache;

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ ephemeral: true }).catch(err => { throw err });
    
    const message: string = interaction.options.getString('code', true);
    const user: User | null = interaction.options.getUser('user');

    if (!tipCache) tipCache = new TipCache();
    const tips: ITip[] = await tipCache.getTips().catch(() => []);
    let replyMessage: InteractionReplyOptions = {};

    if (!tips.length) return interaction.editReply('No tips available.');

    if (!!message) {
        const tip: ITip | undefined = tips.find(t => t.prompt.toLowerCase() === message.toLowerCase());
        if (!!tip) {
            await interaction.editReply({ content: 'Tip posted!', embeds: [], components: [] });
            const postable: InteractionReplyOptions = { embeds: [] };
            replyMessage.content = 
                `${user ? `${user.toString()}\n` : null}`+
                `${tip.message || null}`+
                `${!tip.embed? `\n-# Tip requested by ${interaction.user.displayName}`: null}`;
            if (tip.embed) {
                const embedData = JSON.parse(tip.embed) as EmbedData;
                const embedToShow = embedBulderWithOverrides(embedData, interaction);
                replyMessage.embeds = [ embedToShow ]
            }
            else (postable.content)
            return interaction.editReply(postable);
        }
        else replyMessage.content = `No results found for ${message}`;
    }

}

async function displaySelected(client: Client, selected: InfoResult, interaction: CommandInteraction, user: User | null): Promise<any> {
    logMessage('Posting interaction', { selected: selected.name });
    const postable: PostableInfo = displayInfo(client, selected, user);
    return interaction.followUp(postable);
}

function embedBulderWithOverrides(data: EmbedData, interaction: ChatInputCommandInteraction): EmbedBuilder {
    return new EmbedBuilder(data)
    .setFooter({ text:`Tip requested by ${interaction.user.displayName || '???'}`, iconURL: interaction.user.avatarURL() || '' } )
    .setTimestamp(new Date())
    .setColor(0xda8e35);
}

async function autocomplete(client: Client, interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused();
    try {
        if (!tipCache) tipCache = new TipCache();
        const tips = await tipCache.getApprovedTips();
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