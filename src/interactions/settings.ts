import { CommandInteraction, Client, Guild, MessageEmbed, Role, ThreadChannel, GuildChannel, GuildMember } from "discord.js";
import { DiscordInteraction, } from "../types/util";
import { getUserByDiscordId, updateServer, getServer } from '../api/bot-db';
import { NexusUser } from "../types/users";
import { BotServer } from "../types/servers";
import { ClientExt } from "../types/util";
import { logMessage } from "../api/util";
import { IGameInfo } from "@nexusmods/nexus-api";
import { games } from "../api/nexus-discord";
import { APIRole } from "discord-api-types";

interface BotServerChange {
    name: string;
    cur: any | Role | IGameInfo | string | undefined;
    new: any | Role | IGameInfo | string | undefined;
    data: Partial<BotServer>;
}

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'settings',
        description: 'Adjust settings for this bot in your server.',
        options: [
            {
                name: 'view',
                type: 'SUB_COMMAND',
                description: 'View the current settings for this server',
                options: []
            },
            {
                name: 'update',
                type: 'SUB_COMMAND_GROUP',
                description: 'Update the settings for this server',
                options: [
                    {
                        name: 'filter',
                        type: 'SUB_COMMAND',
                        description: 'The game to used for mod search commands',
                        options: [
                            {
                                name: 'game',
                                type: 'STRING',
                                description: 'The domain name or title (must be exact). e.g. Stardew Valley or stardewvalley'
                            }
                        ]
                    },
                    {
                        name: 'role',
                        type: 'SUB_COMMAND',
                        description: 'The roles assigned by the bot.',
                        options: [
                            {
                                name: 'type',
                                type: 'STRING',
                                description: 'The role type to edit.',
                                required: true,
                                choices: [
                                    {
                                        value: 'author',
                                        name: 'Mod Author'
                                    },
                                    {
                                        value: 'linked',
                                        name: 'Linked to Nexus Mods'
                                    },
                                    {
                                        value: 'premium',
                                        name: 'Nexus Mods Premium'
                                    },
                                    {
                                        value: 'supporter',
                                        name: 'Nexus Mods Supporter'
                                    }
                                ]
                            },
                            {
                                name: 'newrole',
                                type: 'ROLE',
                                description: 'Role to use. To unset, leave this blank.'
                            }
                        ]
                    },
                    {
                        name: 'channel',
                        type: 'SUB_COMMAND',
                        description: 'Channels used by the bot.',
                        options: [
                            {
                                name: 'type',
                                type: 'STRING',
                                description: 'The channel to edit',
                                required: true,
                                choices: [
                                    {
                                        value: 'replychannel',
                                        name: 'Text-Command Reply Channel'
                                    },
                                    {
                                        value: 'logchannel',
                                        name: 'Activity Log'
                                    }
                                ]
                            },
                            {
                                name: 'newchannel',
                                type: 'CHANNEL',
                                description: 'Channel to use. To unset, leave this blank.'
                            }
                        ]
                    },
                    {
                        name: 'value',
                        type: 'SUB_COMMAND',
                        description: 'Update a setting value',
                        options: [
                            {
                                name: 'key',
                                type: 'STRING',
                                description: 'The key to update',
                                choices: [
                                    {
                                        value: 'authordownloads',
                                        name: 'Minimum Unique Downloads to be considered a Mod Author'
                                    }
                                ],
                                required: true
                            },
                            {
                                name: 'newvalue',
                                type: 'INTEGER',
                                description: 'The numerical value to set',
                            }
                        ]
                    }                  

                ]
            },
        ]
    },
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: ClientExt, interaction: CommandInteraction): Promise<any> {
    logMessage('Settings interaction triggered', 
    { 
        user: interaction.user.tag, 
        guild: interaction.guild?.name, 
        interaction: interaction.toString(),
        channel: (interaction.channel as any)?.name
    });

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
    if (!interaction.memberPermissions?.toArray().includes('ADMINISTRATOR') 
    && !client.config.ownerID?.includes(discordId)) {
        return interaction.editReply('Server settings are only accessible by administrators');
    }

    // Get user and guild data
    try {
        const server: BotServer = await getServer(guild)
        .catch((err) => { throw new Error('Could not retrieve server details'+err.message) }); 
        const user: NexusUser|undefined = await getUserByDiscordId(discordId);
        const gameList: IGameInfo[] = user ? await games(user) : [];
        const filterGame: IGameInfo|undefined = gameList.find(g => g.id.toString() === server.game_filter?.toString());

        // Viewing the current settings
        if (!subComGroup && subCom === 'view') {
            const view: MessageEmbed = await serverEmbed(client, guild, server, filterGame?.name);
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
                                data: { channel_bot: newChannel?.id }
                            };
                        
                        }
                        break;
                        case 'logchannel': {
                            newData = {
                                cur: server.channel_nexus,
                                name: 'Log Channel',
                                new: newChannel,
                                data: { channel_nexus: newChannel?.id }
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
                    let foundGame : IGameInfo | undefined;
                    if (!!gameQuery) {
                        foundGame = resolveFilter(gameList, gameQuery);
                        if (!foundGame) throw new Error(`Could not locate a game with a title, domain or ID matching "${gameQuery}"`);
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
                        cur: parseInt(server.author_min_downloads).toLocaleString(),
                        new: newInt?.toLocaleString() || (1000).toLocaleString(),
                        data: { author_min_downloads: newInt?.toString() || '1000' }
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
    catch(err) {
        throw err;        
    }
}

const updateEmbed = (data: BotServerChange): MessageEmbed => { 
    const curVal = (data.cur as IGameInfo) ? data.cur?.name : !data.cur ? '*none*' : data.cur?.toString();
    const newVal = (data.new as IGameInfo) ? data.new?.name : !data.new ? '*none*' : data.cur?.toString();
    console.log({curVal, newVal, data});
    return new MessageEmbed()
    .setTitle('Configuration updated')
    .setColor(0xda8e35)
    .setDescription(`${data.name} updated from ${curVal || data.cur} to ${newVal || data.new}`);
}

function resolveFilter(games: IGameInfo[], term: string|null|undefined): IGameInfo|undefined {
    logMessage('Resolve game', { term, total: games.length });
    if (!term || !games.length) return;
    const game = games.find(g => g.name.toLowerCase() === term.toLowerCase() || g.domain_name.toLowerCase() === term.toLowerCase() || g.id === parseInt(term));
    return game;
}

const serverEmbed = async (client: Client, guild: Guild, server: BotServer, gameName?: string): Promise<MessageEmbed> => {
    const linkedRole: Role|null = server.role_linked ? guild.roles.resolve(server.role_linked) : null;
    const premiumRole: Role|null = server.role_premium ? guild.roles.resolve(server.role_premium) : null;
    const supporterRole: Role|null = server.role_supporter ? guild.roles.resolve(server.role_supporter) : null;
    const authorRole: Role|null = server.role_author ? guild.roles.resolve(server.role_author) : null;
    const botChannel: ThreadChannel | GuildChannel|null = server.channel_bot ? guild.channels.resolve(server.channel_bot) : null;
    const nexusChannel: ThreadChannel | GuildChannel|null = server.channel_nexus ? guild.channels.resolve(server.channel_nexus) : null;
    const logChannel: ThreadChannel | GuildChannel|null = server.channel_log ? guild.channels.resolve(server.channel_log) : null;
    const newsChannel: ThreadChannel|GuildChannel|null = server.channel_news ? guild.channels.resolve(server.channel_news) : null;
    const owner: GuildMember = await guild.fetchOwner();
    const minDownloads: Number = parseInt(server.author_min_downloads) || 1000;

    const embed = new MessageEmbed()
    .setAuthor({ name: guild.name, iconURL: guild.iconURL() || '' })
    .setTitle(`Server Configuration - ${guild.name}`)
    .setDescription('Configure any of these options for your server by using the /settings command`')
    .setColor(0xda8e35)
    .addField(
        'Role Settings', 
        'Set roles for linked accounts, mod authors and Nexus Mods memberships.\n\n'+
        `**Connected Accounts:** ${linkedRole?.toString() || '*Not set*'}\n`+
        `**Mod Authors:** ${authorRole?.toString() || '*Not set*'} (Users with ${minDownloads.toLocaleString()}+ unique downloads)\n`+
        `**Supporter/Premium:** ${supporterRole?.toString() || '*Not set*'}/${premiumRole?.toString() || '*Not set*'}`
    )
    .addField(
        'Channel Settings',
        'Set a bot channel to limit bot replies to one place or set a channel for bot logging messages.\n\n'+
        `**Reply Channel:** ${botChannel?.toString() || '*<any>*'}\n`+
        `**Log Channel:** ${nexusChannel?.toString() || '*Not set*'}`
    )
    .addField(
        'Search', 
        `Showing ${server.game_filter ? `mods from ${gameName || server.game_filter}` : 'all games' }.`
    )
    .setFooter({ text: `Server ID: ${guild.id} | Owner: ${owner?.user.tag}`, iconURL: client.user?.avatarURL() || '' });

    if (newsChannel || logChannel) embed.addField('Depreciated Channels', `News: ${newsChannel?.toString() || 'n/a'}, Log: ${logChannel?.toString() || 'n/a'}`);
    if (server.official) embed.addField('Official Nexus Mods Server', 'This server is an official Nexus Mods server, all bot functions are enabled.');

    return embed;
}

export { discordInteraction };