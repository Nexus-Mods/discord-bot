import { 
    CommandInteraction, Client, Guild, EmbedBuilder, 
    Role, ThreadChannel, GuildChannel, GuildMember, 
    SlashCommandBuilder, ChatInputCommandInteraction, 
    PermissionFlagsBits, 
    APIRole
} from "discord.js";
import { getUserByDiscordId, updateServer, getServer, getConditionsForRole, addConditionForRole } from '../api/bot-db';
import { BotServer } from "../types/servers";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";
import { logMessage } from "../api/util";
import { IGameInfo } from "@nexusmods/nexus-api";
import { DiscordBotUser } from "../api/DiscordBotUser";
import { IGameStatic } from "../api/queries/other";
import { autocompleteGameName } from "../api/util";

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
        .addSubcommand(sc =>
            sc.setName('role')
            .setDescription('Set a claimable role with specific Nexus Mods account conditions')
            .addRoleOption(option =>
                option.setName('role')
                .setDescription('Role to use. Must be lower than the bot role in server settings.')
            )
        )
        .addSubcommand(sc => 
            sc.setName('add-role-conditions')
            .setDescription('Add a criteria for the claimable role')
            .addStringOption(option =>
                option.setName('type')
                .setDescription('The type of requirement')
                .setChoices([
                    {
                        name: "Total Mod Downloads",
                        value: "modDownloads"
                    },
                    {
                        name: 'Total Mods Uploaded',
                        value: 'modsPublished'
                    }
                ]).setRequired(true)
            )
            .addStringOption(option => 
                option.setName('game')
                .setDescription('The game this requirement applies to')
                .setAutocomplete(true)
                .setRequired(true)
            )
            .addNumberOption(option => 
                option.setName('count')
                .setDescription('The minimum number to satisfy the requirement')
                .setMinValue(0)
                .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('op')
                .setDescription('Operator to use (Default: AND)')
                .setChoices([
                    {
                        name: 'AND',
                        value: 'AND'
                    },
                    {
                        name: 'OR',
                        value: 'OR'
                    }
                ])
            )
            
        )
        .addSubcommand(sc => 
            sc.setName('remove-role-conditions')
            .setDescription('Remove a crieria for the claimable role')
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
type SubCommands = 'view' | 'searchfilter' | 'role' | 'add-role-conditions' | 'remove-role-conditions';
type OptionNames = 'game' | 'role' | 'count' | 'op' | 'type';

enum ConditionType {
    modDownloads = 'mod downloads',
    modsPublished = 'mods published'
}

interface IBotServerChange {
    name: string;
    cur: any | Role | IGameInfo | string | undefined;
    new: any | Role | IGameInfo | string | undefined;
    data: Partial<BotServer>;
};

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

            // Handle the subcommand
            switch (subCom) {
                case 'searchfilter': newData = await updateSearchFilter(interaction, gameList, server);
                break;
                case 'role': newData = await updateClaimableRole(interaction, gameList, server, guild);
                break;
                case 'add-role-conditions': return addRoleConditions(interaction, gameList, server, guild);
                case 'remove-role-conditions': await removeRoleConditions();
                default: throw new Error('Unrecognised SubCommand: '+subCom);
            }

            if (!Object.keys(newData).length) return interaction.editReply('No updates needed');

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
    const gameQuery: string | null = interaction.options.getString('game' as OptionNames);
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

async function updateClaimableRole(interaction: ChatInputCommandInteraction, gameList: IGameStatic[], server: BotServer, guild: Guild): Promise<Partial<IBotServerChange>> {
    // Need to get the role the user picked
    const newRole: Role | APIRole | null = interaction.options.getRole('role', false);
    const currentRole: Role | APIRole | null = server.role_author ? await guild.roles.fetch(server.role_author) : null;
    // No change means we can exit. 
    if ((newRole === null && currentRole === null) || newRole?.id === currentRole?.id) return {};

    return {
        name: 'Claimable Role',
        cur: currentRole,
        new: newRole,
        data: { role_author: newRole!.id }
    }
}

async function addRoleConditions(interaction: ChatInputCommandInteraction, gameList: IGameStatic[], server: BotServer, guild: Guild) {    
    // Get the role for the server
    const roleId: string | undefined = server.role_author;
    console.log(server);
    if (roleId === undefined) return interaction.editReply('No role configured. Use the `/settings update role` option to set a role.');
    const role: Role | APIRole| null = await guild.roles.fetch(roleId!);
    if (role === null) return interaction.editReply('Configured role no longer exists. Use the `/settings update role` option to set a role.');
    // Get current conditions
    const currentConditions = await getConditionsForRole(guild.id, role!.id);
    if (currentConditions.length >= 5) return interaction.editReply('Maximum number of conditions reached, please remove one to make further changes.');
    
    // Get the variables from the command
    const type: 'modDownloads' | 'modsPublished' = interaction.options.getString('type' as OptionNames, true) as 'modDownloads' | 'modsPublished';
    const game: string = interaction.options.getString('game' as OptionNames, true);
    const minCount: number = interaction.options.getNumber('count' as OptionNames, true);
    const op: 'AND' | 'OR' = interaction.options.getString('op' as OptionNames) as 'AND' | 'OR' ?? 'AND';

    // Get the game
    const gameInfo = gameList.find(g => g.domain_name === game);
    if (!gameInfo) return interaction.editReply(`Invalid game: ${game}`);

    logMessage('Adding role condition', { roleId, type, game, minCount, op });

    try {
        const newCondition = await addConditionForRole(guild.id, roleId!, type, game, minCount, op);
        const newConditions = [...currentConditions, newCondition];
        // Show a pretty embed with all current options;
        const conditionText = newConditions.map(c => (`- ${c.min.toLocaleString()}+ ${ConditionType[c.type]} for ${gameList.find(g => g.domain_name === c.game)!.name} :: ${c.op}`))

        const embed = new EmbedBuilder()
        .setTitle('Role Conditions')
        .setDescription(`Conditions for ${role?.toString()}\n\n${conditionText.join('\n')}`);

        return interaction.editReply({ content: 'Role conditions updated', embeds: [embed] });
    }
    catch(err) {
        logMessage('Error adding role condition', err, true);
        return interaction.editReply('Error adding role condition');
    }
}

async function removeRoleConditions() {
    throw new Error('Not implemented')
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