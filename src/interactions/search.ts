import { CommandInteraction, MessageActionRow, MessageSelectMenu, Client, MessageSelectOptionData, MessageEmbed, Message, InteractionCollector, MessageButton } from "discord.js";
import { DiscordInteraction, InfoResult, PostableInfo } from "../types/util";
import { } from '../api/bot-db';
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'search',
        description: 'Quickly search for games or mods.',
        options: [
            {
                type: 'SUB_COMMAND',
                name: 'mods',
                description: 'Search for mods on Nexus Mods',
                options: [
                    {
                        name: 'mod-title',
                        type: 'STRING',
                        description: 'Search by mod title',
                        required: true,
                    }
                ]
            },
            {
                type: 'SUB_COMMAND',
                name: 'games',
                description: 'Search for games on Nexus Mods',
                options: [
                    {
                        name: 'game-title',
                        type: 'STRING',
                        description: 'Search by game title',
                        required: true
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

async function action(client: Client, interaction: CommandInteraction): Promise<any> {
    logMessage('Search interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: interaction.channel?.toString() });

    const modQuery: string | null = interaction.options.getString('mod-title');
    const gameQuery : string | null = interaction.options.getString('game-title');

    const searchType : string | null = !!modQuery ? 'MOD' : !!gameQuery ? 'GAME': null;

    if (!searchType) return interaction.reply('Invalid search parameters');

    await interaction.deferReply({ ephemeral: true });

    switch(searchType) {
        case 'MOD' : return searchMods(modQuery || '', client, interaction);
        case 'GAME' : return searchGames(gameQuery || '', client, interaction);
        default: return interaction.editReply('Search error: Neither mods or games were selected.');
    }
}

async function searchMods(query: string, client: Client, interaction: CommandInteraction) {
    logMessage('Mod search', {query})
}

async function searchGames(query: string, client: Client, interaction: CommandInteraction) {
    logMessage('Game search', {query})
}

export { discordInteraction };