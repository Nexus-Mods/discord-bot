import { 
    CommandInteraction, Client, Guild, EmbedBuilder, 
    Role, ThreadChannel, GuildChannel, GuildMember, 
    SlashCommandBuilder, ChatInputCommandInteraction, 
    PermissionFlagsBits 
} from "discord.js";
import { getUserByDiscordId, updateServer, getServer } from '../api/bot-db';
import { BotServer } from "../types/servers";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";
import { logMessage } from "../api/util";
import { IGameInfo } from "@nexusmods/nexus-api";
import { DiscordBotUser } from "../api/DiscordBotUser";
import { IGameStatic } from "../api/queries/other";
import { autocompleteGameName } from "../api/util";

interface IBotServerChange {
    name: string;
    cur: any | Role | IGameInfo | string | undefined;
    new: any | Role | IGameInfo | string | undefined;
    data: Partial<BotServer>;
}

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setName('settings')
    .setDescription('Adjust settings for this bot in your server.')
    .addSubcommand(sc => 
        sc.setName('view')
        .setDescription('View the current settings for this server.')
    )
    .addSubcommandGroup(scg =>
        scg.setName('update')
        .setDescription('Update the settings for this server.')
        .addSubcommand(sc => 
            sc.setName('searchfilter')
            .setDescription('The default game filter to used for search commands.')
            .addStringOption(option =>
                option.setName('game')   
                .setDescription('Game Title. e.g. Stardew Valley or stardewvalley.')
                .setAutocomplete(true)
            )
        )
    ) as SlashCommandBuilder,
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action,
    autocomplete: autocompleteGameName
}

type SubCommandGroups = 'update';
type SubCommands = 'view' | 'searchfilter';
type OptionNames = 'game';

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);

    await interaction.deferReply({ ephemeral: true });

    // Outcomes: update, null
    const subComGroup: SubCommandGroups | null = interaction.options.getSubcommandGroup(false) as SubCommandGroups;
    // Outcomes: view, filter, role, channel
    const subCom: SubCommands = interaction.options.getSubcommand() as SubCommands;
    // Some important IDs
    const discordId : string = interaction.user.id;
    const guild : Guild | null = interaction.guild;
    if (!guild) throw new Error('This interaction only works in a valid server');

    // Check we're dealing with a server admin.
    if (!interaction.memberPermissions?.toArray().includes('ManageGuild') 
    && !client.config.ownerID?.includes(discordId)) {
        return interaction.editReply('Server settings are only accessible by Guild managers');
    }

    // Get user and guild data
    try {
        const server: BotServer = await getServer(guild)
        .catch((err) => { throw new Error('Could not retrieve server details'+err.message) }); 
        const user: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
        const gameList: IGameStatic[] = await client.gamesList?.getGames() ?? [];

        // Viewing the current settings
        if (!subComGroup && subCom === 'view') return viewServerInfo(client, interaction, guild, gameList, server);
        // Update 
        else if (subComGroup === 'update') {
            let newData: Partial<IBotServerChange> = {};

            switch (subCom) {
                case 'searchfilter': newData = await updateSearchFilter(interaction, gameList, server);
                break;
                default: throw new Error('Unrecognised SubCommand: '+subCom);
            }

            try {
                await updateServer(server.id, newData.data);
                return interaction.editReply({ embeds: [updateEmbed(newData as IBotServerChange)] })
            }
            catch (err) {
                throw new Error('Error updating server data: '+(err as Error).message)
            }
        }
        else throw new Error('Unrecognised command');
    }
    catch(err:any) {
        if (err.message.startsWith('Invalid Game')) interaction.editReply({ embeds: [], content: err.message }).catch(() => undefined);
        throw err;        
    }
}

async function viewServerInfo(client: ClientExt, interaction: CommandInteraction, guild: Guild, gameList: IGameStatic[], server: BotServer, ) {
    const filterGame: IGameStatic|undefined = gameList.find(g => g.id.toString() === server.game_filter?.toString());
    const view: EmbedBuilder = await serverEmbed(client, guild, server, filterGame?.name);
    return interaction.editReply({ embeds: [view] });
}

async function updateSearchFilter(interaction: ChatInputCommandInteraction, gameList: IGameStatic[], server: BotServer): Promise<Partial<IBotServerChange>> {
    const gameQuery: OptionNames | null = interaction.options.getString('game') as OptionNames;
    let foundGame : IGameStatic | undefined;
    if (!!gameQuery) {
        foundGame = resolveFilter(gameList, gameQuery);
        if (!foundGame) throw new Error(`Invalid Game: Could not locate a game with a title, domain or ID matching "${gameQuery}"`);
    }
    return {
        name: 'Mod Search Filter',
        cur: resolveFilter(gameList, server.game_filter?.toString()),
        new: foundGame,
        data: { game_filter: foundGame?.id.toString() }
    }
}

const updateEmbed = (data: IBotServerChange): EmbedBuilder => { 
    const curVal = (data.cur as IGameInfo) ? data.cur?.name : !data.cur ? '*none*' : data.cur?.toString();
    const newVal = (data.new as IGameInfo) ? data.new?.name : !data.new ? '*none*' : data.cur?.toString();
    console.log({curVal, newVal, data});
    return new EmbedBuilder()
    .setTitle('Configuration updated')
    .setColor(0xda8e35)
    .setDescription(`${data.name} updated from ${curVal || data.cur} to ${newVal || data.new}`);
}

function resolveFilter(games: IGameStatic[], term: string|null|undefined): IGameStatic|undefined {
    logMessage('Resolve game', { term, total: games.length });
    if (!term || !games.length) return;
    const game = games.find(g => g.name.toLowerCase() === term.toLowerCase() || g.domain_name.toLowerCase() === term.toLowerCase() || g.id === parseInt(term));
    return game;
}

const serverEmbed = async (client: Client, guild: Guild, server: BotServer, gameName?: string): Promise<EmbedBuilder> => {
    // const botChannel: ThreadChannel | GuildChannel|null = server.channel_bot ? guild.channels.resolve(server.channel_bot) : null;
    const nexusChannel: ThreadChannel | GuildChannel|null = server.channel_nexus ? guild.channels.resolve(server.channel_nexus) : null;
    const logChannel: ThreadChannel | GuildChannel|null = null //server.channel_log ? guild.channels.resolve(server.channel_log) : null;
    const newsChannel: ThreadChannel|GuildChannel|null = server.channel_news ? guild.channels.resolve(server.channel_news) : null;
    const owner: GuildMember = await guild.fetchOwner();

    const embed = new EmbedBuilder()
    .setAuthor({ name: guild.name, iconURL: guild.iconURL() || '' })
    .setTitle(`Server Configuration - ${guild.name}`)
    .setDescription('Configure any of these options for your server by using the /settings command`')
    .setColor(0xda8e35)
    .addFields([
        {
            name: 'Role Settings', 
            value: 'These settings can now be managed using [Linked Roles](https://discord.com/blog/connected-accounts-functionality-boost-linked-roles) in Discord.'
        },
        {
            name: 'Channel Settings',
            value: 'Set a bot channel to limit bot replies to one place or set a channel for bot logging messages.\n\n'+
            // `**Reply Channel:** ${botChannel?.toString() || '*<any>*'}\n`+
            `**Log Channel:** ${nexusChannel?.toString() || '*Not set*'}`
        },
        {
            name: 'Search',
            value: `Showing ${server.game_filter ? `mods from ${gameName || server.game_filter}` : 'all games' }.`
        }
    ])
    .setFooter({ text: `Server ID: ${guild.id} | Owner: ${owner?.user.tag}`, iconURL: client.user?.avatarURL() || '' });

    if (newsChannel || logChannel) embed.addFields({ name: 'Deprecated Channels', value: `News: ${newsChannel?.toString() || 'n/a'}, Log: ${(logChannel as any)?.toString() || 'n/a'}`});
    if (server.official) embed.addFields({ name: 'Official Nexus Mods Server', value: 'This server is an official Nexus Mods server, all bot functions are enabled.'});

    return embed;
}

export { discordInteraction };