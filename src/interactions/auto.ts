import { AutocompleteInteraction, ChatInputCommandInteraction, CommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getUserByDiscordId } from '../api/bot-db';
import { logMessage } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";
import { other } from "../api/queries/all";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('auto')
    .setDescription('Testing Autocomplete.')
    .addStringOption(option => 
        option.setName('game')
        .setDescription('Game to search for')
        .setAutocomplete(true)
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        '581095546291355649',
        '268004475510325248',

    ],
    action,
    autocomplete,
}

interface IGame {
    approved_date: number;
    collections: number;
    domain_name: string;
    downloads: number;
    file_count: number;
    forum_url: string;
    genre: string;
    id: number;
    mods: number;
    name: string;
    name_lower: string;
    nexusmods_url: string;
}

class GameCache {
    public dateStamp: number;
    public games: IGame[];

    constructor() {
        this.dateStamp = -1;
        this.games = [];
    }

    async getGames(): Promise<IGame[]> {
        if (this.dateStamp > Date.now()) {
            return this.games;
        }
        else {
            const games = await other.Games({});
            this.games = games;
            this.dateStamp = Date.now() + 300000;
            return games;
        }
    }
}

const cache = new GameCache();

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.user.id;

    const selectedGame = interaction.options.getString('game', true);

    const botuser: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
    if (!botuser) return interaction.editReply({ content: 'Error! No linked user!' });
    try {
        const game = await botuser.NexusMods.API.v1.Game(selectedGame);
        return interaction.editReply({ content: '```'+JSON.stringify(game)+'```' });
    }
    catch(err) {
        logMessage('Error', { selectedGame, err}, true);
        return interaction.editReply({ content: 'Error! '+err });
    }
}

async function autocomplete(client: ClientExt, acInteraction: AutocompleteInteraction) {
    const focused = acInteraction.options.getFocused();
    try {
        const games = await cache.getGames();
        const filtered = games.sort((a, b) => a.downloads > b.downloads ? 0 : 1).filter(g => g.name.toLowerCase().startsWith(focused.toLowerCase()) || g.domain_name.includes(focused.toLowerCase()));
        await acInteraction.respond(
            filtered.map(g => ({ name: g.name, value: g.domain_name })).slice(0, 25)
        );
    }
    catch(err) {
        logMessage('Error autocompleting', {err}, true);
    }
}

export { discordInteraction }