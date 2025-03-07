import { AutocompleteInteraction, ChatInputCommandInteraction, CommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getUserByDiscordId } from '../api/bot-db';
import { logMessage } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";
import { autocompleteGameName } from '../api/util';

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('auto')
    .setDescription('Testing Autocomplete.')
    .addStringOption(option => 
        option.setName('game')
        .setDescription('Game to search for')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,
    public: false,
    guilds: [
        '581095546291355649',
        '268004475510325248',

    ],
    action,
    autocomplete: autocompleteGameName,
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.user.id;

    const selectedGame = interaction.options.getString('game', true);

    const botuser: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
    if (!botuser) return interaction.editReply({ content: 'Error! No linked user!' });
    try {
        const game = await botuser.NexusMods.API.v1.Game(selectedGame);
        return interaction.editReply({ content: '```\n'+game.name+'\n```' });
    }
    catch(err) {
        logMessage('Error', { selectedGame, err}, true);
        throw err;
    }
}

export { discordInteraction };