import { CommandInteraction, Channel, Client, Guild, MessageEmbed, Role, ThreadChannel, GuildChannel, GuildMember } from "discord.js";
import { DiscordInteraction, } from "../types/util";
import { getUserByDiscordId, updateServer, getServer } from '../api/bot-db';
import { NexusUser } from "../types/users";
import { BotServer } from "../types/servers";
import { ClientExt } from "../types/util";
import { logMessage } from "../api/util";
import { IGameInfo } from "@nexusmods/nexus-api";
import { games } from "../api/nexus-discord";

interface BotServerChange {
    name: string;
    cur: Channel | Role | IGameInfo | string;
    new: Channel | Role | IGameInfo | string;
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
                                        name: 'author',
                                        value: 'Mod Author'
                                    },
                                    {
                                        name: 'linked',
                                        value: 'Linked to Nexus Mods'
                                    },
                                    {
                                        name: 'premium',
                                        value: 'Nexus Mods Premium'
                                    },
                                    {
                                        name: 'supporter',
                                        value: 'Nexus Mods Supporter'
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
                                        name: 'replychannel',
                                        value: 'Text-Command Reply Channel'
                                    },
                                    {
                                        name: 'logchannel',
                                        value: 'Activity Log'
                                    }
                                ]
                            },
                            {
                                name: 'newchannel',
                                type: 'CHANNEL',
                                description: 'Channel to use. To unset, leave this blank.'
                            }
                        ]
                    }                    

                ]
            },
        ]
    },
    public: false,
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
                case 'channel': 
                break;
                case 'role':
                break;
                case 'filter':
                break;
                default: throw new Error('Unrecognised SubCommand: '+subCom);
            }

        }
        else throw new Error('Unrecognised command');
    }
    catch(err) {
        throw err;        
    }
    
    return interaction.editReply({ content: `\`\`\`${interaction.toString()}\`\`\`` });
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

    const embed = new MessageEmbed()
    .setAuthor({ name: guild.name, iconURL: guild.iconURL() || '' })
    .setTitle(`Server Configuration - ${guild.name}`)
    .setDescription('Configure any of these options for your server by typing the following command: \n`!NM config <setting> <newvalue>`')
    .setColor(0xda8e35)
    .addField(
        'Role Settings', 
        'Set roles for linked accounts, mod authors and Nexus Mods memberships.\n\n'+
        `**Connected Accounts:** ${linkedRole?.toString() || '*Not set*'} - set using \`linked <@role>\`\n`+
        `**Mod Authors:** ${authorRole?.toString() || '*Not set*'} - set using \`author <@role>\`\n`+
        `**Supporter/Premium:** ${supporterRole?.toString() || '*Not set*'}/${premiumRole?.toString() || '*Not set*'} - set using \`premium <@role>\` or \`supporter <@role>\``
    )
    .addField(
        'Channel Settings',
        'Set a bot channel to limit bot replies to one place or set a channel for bot logging messages.\n\n'+
        `**Reply Channel:** ${botChannel?.toString() || '*<any>*'} - set using \`replyonly <#channel>\`\n`+
        `**Log Channel:** ${nexusChannel?.toString() || '*Not set*'} - set using \`log <#channel>\``
    )
    .addField(
        'Search', 
        `Showing ${server.game_filter ? `mods from ${gameName || server.game_filter}` : 'all games' }. - set using \`filter <game name/domain>\``
    )
    .setFooter({ text: `Server ID: ${guild.id} | Owner: ${owner?.user.tag}`, iconURL: client.user?.avatarURL() || '' });

    if (newsChannel || logChannel) embed.addField('Depreciated Channels', `News: ${newsChannel?.toString() || 'n/a'}, Log: ${logChannel?.toString() || 'n/a'}`);
    if (server.official) embed.addField('Official Nexus Mods Server', 'This server is an official Nexus Mods server, all bot functions are enabled.');

    return embed;
}

export { discordInteraction };