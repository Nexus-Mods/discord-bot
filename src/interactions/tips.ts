import { 
    CommandInteraction, EmbedBuilder, User, 
    SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction,
    EmbedData, InteractionEditReplyOptions
} from "discord.js";
import { ClientExt, DiscordInteraction } from '../types/DiscordTypes';
import { Logger } from "../api/util";
import { ITip } from "../api/tips";
import { TipCache } from "../types/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('tips')
    .setDescription('Return a quick info message on a number of topics.')
    .addStringOption(option =>
        option.setName('prompt')
        .setDescription('Start typing the tip title or prompt.')
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

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply().catch(err => { throw err });
    
    const message: string = interaction.options.getString('prompt', true);
    const user: User | null = interaction.options.getUser('user');

    if (!client.tipCache) client.tipCache = new TipCache();
    const tips: ITip[] = await client.tipCache.getTips().catch(() => []);
    let replyMessage: InteractionEditReplyOptions = { content: '' };

    if (!!message) {
        const tip: ITip | undefined = tips.find(t => t.prompt.toLowerCase() === message.toLowerCase());
        if (!!tip) {
            if (user) replyMessage.content = replyMessage.content + `${user.toString()}\n`;
            if (tip.message) replyMessage.content = replyMessage.content + `${tip.message}`;
            if (tip.embed) {
                const embedData = JSON.parse(tip.embed) as EmbedData;
                const embedToShow = embedBulderWithOverrides(tip, embedData, interaction);
                replyMessage.embeds = [ embedToShow ]
            }
            else replyMessage.content = replyMessage.content + `\n-# Tip submitted by ${tip.author}`;

            // Clean out the content if it's blank
            if (replyMessage.content === '') delete replyMessage.content;
        }
        else replyMessage.content = `No results found for ${message}`;

        return interaction.editReply(replyMessage);
    }
    else throw new Error('Tip prompt was not provided.')

}

function embedBulderWithOverrides(tip: ITip, data: EmbedData, interaction: ChatInputCommandInteraction): EmbedBuilder {
    return new EmbedBuilder(data)
    .setFooter({ text:`Last updated by ${tip.author || '???'}`, iconURL: interaction.user.avatarURL() || '' } )
    .setTimestamp(new Date(tip.updated))
    .setColor(0xda8e35);
}

async function autocomplete(client: ClientExt, interaction: AutocompleteInteraction, logger: Logger) {
    const focused = interaction.options.getFocused().toLowerCase();
    try {
        if (!client.tipCache) client.tipCache = new TipCache();
        let tips = await client.tipCache.getApprovedTips();
        if(focused.length) tips = tips.filter(t => t.prompt.toLowerCase().includes(focused) || t.title.toLowerCase().includes(focused) );
        await interaction.respond(
            tips.map(t => ({ name: t.title, value: t.prompt })).slice(0, 25)
        );
    }
    catch(err) {
        logger.warn('Error autocompleting tips', {err});
        throw err;
    }
}

export { discordInteraction };