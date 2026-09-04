import { 
    type CommandInteraction, EmbedBuilder, type User, 
    SlashCommandBuilder, type ChatInputCommandInteraction, type AutocompleteInteraction,
    type EmbedData, type InteractionEditReplyOptions, InteractionContextType} from "discord.js";
import type { ClientExt, DiscordInteraction } from '../types/DiscordTypes.js';
import type { Logger } from "../api/logger.js";
import type { ITip } from "../api/tips.js";
import { NEXUS_ORANGE } from '../lib/embeds.js';
import { getTipCache } from '../lib/caches.js';

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
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM) as SlashCommandBuilder,
    public: true,
    guilds: [],
    defer: 'public',
    action,
    autocomplete
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, _logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    
    const message: string = interaction.options.getString('prompt', true);
    const user: User | null = interaction.options.getUser('user');

    const tips: ITip[] = await getTipCache(client).getTips().catch(() => []);
    const replyMessage: InteractionEditReplyOptions = { content: '' };

    if (message) {
        const tip: ITip | undefined = tips.find(t => t.prompt.toLowerCase() === message.toLowerCase());
        if (tip) {
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
    .setColor(NEXUS_ORANGE);
}

async function autocomplete(client: ClientExt, interaction: AutocompleteInteraction, logger: Logger) {
    const focused = interaction.options.getFocused().toLowerCase();
    try {
        let tips = await getTipCache(client).getApprovedTips();
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