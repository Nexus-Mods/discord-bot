import { CommandInteraction, Client, Guild, EmbedBuilder, Role, ThreadChannel, GuildChannel, GuildMember, SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { getUserByDiscordId, updateServer, getServer } from '../api/bot-db';
import { NexusUser } from "../types/users";
import { BotServer } from "../types/servers";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";
import { logMessage } from "../api/util";
import { IGameInfo } from "@nexusmods/nexus-api";
import { games } from "../api/nexus-discord";
import { APIRole } from "discord-api-types";
import { DiscordBotUser } from "../api/DiscordBotUser";
import { IGame } from "../api/queries/v2-games";

interface BotServerChange {
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
            sc.setName('filter')
            .setDescription('The game to used for mod search commands.')
            .addStringOption(option =>
                option.setName('game')   
                .setDescription('The domain name or title (must be exact). e.g. Stardew Valley or stardewvalley.') 
            )
        )
        .addSubcommand(sc => 
            sc.setName('role')
            .setDescription('The roles assigned by the bot.')
            .addStringOption(option =>
                option.setName('type')
                .setDescription('The role type to edit.')
                .setRequired(true)
                .addChoices(
                    { name: 'Mod Author', value: 'author' },
                    { name: 'Linked to Nexus Mods', value: 'linked' },
                    { name: 'Nexus Mods Premium', value: 'premium' },
                    { name: 'Nexus Mods Supporter', value: 'supporter' },
                )
            )
            .addRoleOption(option => 
                option.setName('newrole')  
                .setDescription('Role to use. To unset, leave this blank.')
            )
        )
        .addSubcommand(sc => 
            sc.setName('channel')
            .setDescription('Channels used by the bot.')
            .addStringOption(option =>
                option.setName('type')
                .setDescription('The channel to edit.')
                .setRequired(true)
                .addChoices(
                    { name: 'Text-Command Reply Channel', value: 'replychannel' },
                    { name: 'Activity Log', value: 'logchannel' }
                )
            )
            .addChannelOption(option =>
                option.setName('newchannel') 
                .setDescription('Channel to use. To unset, leave this blank.')   
            )
        )
        .addSubcommand(sc => 
            sc.setName('value')
            .setDescription('Channels used by the bot.')
            .addStringOption(option =>
                option.setName('key')
                .setDescription('The key to update.')
                .setRequired(true)
                .addChoices(
                    { name: 'Minimum Unique Downloads to be considered a Mod Author', value: 'authordownloads' }
                )
            )
            .addIntegerOption(option =>
                option.setName('newvalue')
                .setDescription('The numerical value to set.')
            )
        )
    ) as SlashCommandBuilder,
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // logMessage('Settings interaction triggered', 
    // { 
    //     user: interaction.user.tag, 
    //     guild: interaction.guild?.name, 
    //     interaction: interaction.toString(),
    //     channel: (interaction.channel as any)?.name
    // });

    await interaction.deferReply({ ephemeral: true });

    // Outcomes: update, null
    const subComGroup: string | null = interaction.options.getSubcommandGroup(false);
    // Outcomes: view, filter, role, channel
    const subCom: string = interaction.options.getSubcommand();
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
        const gameList: IGame[] = user ? await user.NexusMods.API.v2.Games() : [];
        const filterGame: IGame|undefined = gameList.find(g => g.id.toString() === server.game_filter?.toString());

        // Viewing the current settings
        if (!subComGroup && subCom === 'view') {
            const view: EmbedBuilder = await serverEmbed(client, guild, server, filterGame?.name);
            return interaction.editReply({ embeds: [view] });
        }
        // Update 
        else if (subComGroup === 'update') {
            let newData: Partial<BotServerChange> = {};

            switch (subCom) {
                case 'channel': {
                    const channelType: string = interaction.options.getString('type', true);
                    const newChannel = interaction.options.getChannel('newchannel');

                    switch(channelType) {
                        case 'replychannel': {
                            newData = {
                                cur: server.channel_bot,
                                name: 'Reply Channel',
                                new: newChannel,
                                data: { channel_bot: (newChannel as any)?.id }
                            };
                        
                        }
                        break;
                        case 'logchannel': {
                            newData = {
                                cur: server.channel_nexus,
                                name: 'Log Channel',
                                new: newChannel,
                                data: { channel_nexus: (newChannel as any)?.id }
                            };
                        }
                        break;
                    }
                }
                break;
                case 'role': {
                    const roleType: string = interaction.options.getString('type', true);
                    const newRole: Role | APIRole | null = interaction.options.getRole('newrole');
                    switch(roleType) {
                        case 'author': {
                            newData = {
                                cur: server.role_author,
                                name: 'Mod Author Role',
                                new: newRole,
                                data: { role_author: newRole?.id }
                            };
                        
                        }
                        break;
                        case 'premium': {
                            newData = {
                                cur: server.role_premium,
                                name: 'Log Channel',
                                new: newRole,
                                data: { role_premium: newRole?.id }
                            };
                        }
                        break;
                        case 'supporter': {
                            newData = {
                                cur: server.role_supporter,
                                name: 'Log Channel',
                                new: newRole,
                                data: { role_supporter: newRole?.id }
                            };
                        }
                        break;
                        case 'linked': {
                            newData = {
                                cur: server.role_linked,
                                name: 'Log Channel',
                                new: newRole,
                                data: { role_linked: newRole?.id }
                            };
                        }
                        break;
                    }

                }
                break;
                case 'filter': {
                    const gameQuery: string | null = interaction.options.getString('game');
                    let foundGame : IGame | undefined;
                    if (!!gameQuery) {
                        foundGame = resolveFilter(gameList, gameQuery);
                        if (!foundGame) throw new Error(`Invalid Game: Could not locate a game with a title, domain or ID matching "${gameQuery}"`);
                    }
                    newData = {
                        name: 'Mod Search Filter',
                        cur: resolveFilter(gameList, server.game_filter?.toString()),
                        new: foundGame,
                        data: { game_filter: foundGame?.id }
                    }
                }
                break;
                case 'value': {
                    const valueToEdit: string = interaction.options.getString('key', true);
                    const newInt: number|null = interaction.options.getInteger('newvalue');
                    // Only one value for now, so no harm in hard-coding this.
                    if (valueToEdit !== 'authordownloads') throw new Error('Unknown value key: '+valueToEdit);
                    newData = {
                        name: 'Minimum Unique Downloads for Mod Author role',
                        cur: server.author_min_downloads ? parseInt(server.author_min_downloads).toLocaleString() : 'none',
                        new: newInt?.toLocaleString() || (1000).toLocaleString(),
                        data: { author_min_downloads: newInt?.toString() }
                    }
                }
                break;
                default: throw new Error('Unrecognised SubCommand: '+subCom);
            }

            try {
                await updateServer(server.id, newData.data);
                return interaction.editReply({ embeds: [updateEmbed(newData as BotServerChange)] })
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

const updateEmbed = (data: BotServerChange): EmbedBuilder => { 
    const curVal = (data.cur as IGameInfo) ? data.cur?.name : !data.cur ? '*none*' : data.cur?.toString();
    const newVal = (data.new as IGameInfo) ? data.new?.name : !data.new ? '*none*' : data.cur?.toString();
    console.log({curVal, newVal, data});
    return new EmbedBuilder()
    .setTitle('Configuration updated')
    .setColor(0xda8e35)
    .setDescription(`${data.name} updated from ${curVal || data.cur} to ${newVal || data.new}`);
}

function resolveFilter(games: IGame[], term: string|null|undefined): IGame|undefined {
    logMessage('Resolve game', { term, total: games.length });
    if (!term || !games.length) return;
    const game = games.find(g => g.name.toLowerCase() === term.toLowerCase() || g.domainName.toLowerCase() === term.toLowerCase() || g.id === parseInt(term));
    return game;
}

const serverEmbed = async (client: Client, guild: Guild, server: BotServer, gameName?: string): Promise<EmbedBuilder> => {
    const linkedRole: Role|null = server.role_linked ? guild.roles.resolve(server.role_linked) : null;
    const premiumRole: Role|null = server.role_premium ? guild.roles.resolve(server.role_premium) : null;
    const supporterRole: Role|null = server.role_supporter ? guild.roles.resolve(server.role_supporter) : null;
    const authorRole: Role|null = server.role_author ? guild.roles.resolve(server.role_author) : null;
    const botChannel: ThreadChannel | GuildChannel|null = server.channel_bot ? guild.channels.resolve(server.channel_bot) : null;
    const nexusChannel: ThreadChannel | GuildChannel|null = server.channel_nexus ? guild.channels.resolve(server.channel_nexus) : null;
    const logChannel: ThreadChannel | GuildChannel|null = server.channel_log ? guild.channels.resolve(server.channel_log) : null;
    const newsChannel: ThreadChannel|GuildChannel|null = server.channel_news ? guild.channels.resolve(server.channel_news) : null;
    const owner: GuildMember = await guild.fetchOwner();
    const minDownloads: Number = server.author_min_downloads ? parseInt(server.author_min_downloads) : 1000;

    const embed = new EmbedBuilder()
    .setAuthor({ name: guild.name, iconURL: guild.iconURL() || '' })
    .setTitle(`Server Configuration - ${guild.name}`)
    .setDescription('Configure any of these options for your server by using the /settings command`')
    .setColor(0xda8e35)
    .addFields([
        {
            name: 'Role Settings', 
            value: 'Set roles for linked accounts, mod authors and Nexus Mods memberships.\n\n'+
            `**Connected Accounts:** ${linkedRole?.toString() || '*Not set*'}\n`+
            `**Mod Authors:** ${authorRole?.toString() || '*Not set*'} (Users with ${minDownloads.toLocaleString()}+ unique downloads)\n`+
            `**Supporter/Premium:** ${supporterRole?.toString() || '*Not set*'}/${premiumRole?.toString() || '*Not set*'}`
        },
        {
            name: 'Channel Settings',
            value: 'Set a bot channel to limit bot replies to one place or set a channel for bot logging messages.\n\n'+
            `**Reply Channel:** ${botChannel?.toString() || '*<any>*'}\n`+
            `**Log Channel:** ${nexusChannel?.toString() || '*Not set*'}`
        },
        {
            name: 'Search',
            value: `Showing ${server.game_filter ? `mods from ${gameName || server.game_filter}` : 'all games' }.`
        }
    ])
    .setFooter({ text: `Server ID: ${guild.id} | Owner: ${owner?.user.tag}`, iconURL: client.user?.avatarURL() || '' });

    if (newsChannel || logChannel) embed.addFields({ name: 'Depreciated Channels', value: `News: ${newsChannel?.toString() || 'n/a'}, Log: ${logChannel?.toString() || 'n/a'}`});
    if (server.official) embed.addFields({ name: 'Official Nexus Mods Server', value: 'This server is an official Nexus Mods server, all bot functions are enabled.'});

    return embed;
}

export { discordInteraction };