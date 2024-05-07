import { 
    Client, SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, Snowflake,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageActionRowComponentBuilder, CommandInteraction, APIEmbedField
} from "discord.js";
import { DiscordInteraction, } from "../types/DiscordTypes";
import { getUserByDiscordId, createGameFeed, getGameFeedsForServer, getGameFeed, deleteGameFeed, updateGameFeed } from '../api/bot-db';
import { GameFeed, Feed, ModFeed, CollectionFeed } from "../types/feeds";
import { logMessage } from '../api/util';
import { DiscordBotUser } from "../api/DiscordBotUser";

type FeedType = 'games' | 'mods' | 'collections';
type InteractionType = 'create' | 'manage' | 'list' | 'about';

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('feed')
    .setDescription('Create or manage a game, mod or collection feed in this server.')
    .setDMPermission(false)
    .addSubcommand(sc =>
        sc.setName('about')
        .setDescription('About Feeds.')
    )
    .addSubcommandGroup(scg => 
        scg.setName('collections')
        .setDescription('Collection Feed Management.')
        .addSubcommand(sc =>
            sc.setName('create')
            .setDescription('Create a collection feed in this channel.')
            .addStringOption(option => 
                option.setName('url')
                .setDescription('The link to the Collection page.')
                .setRequired(true)
            )
        )
        .addSubcommand(sc =>
            sc.setName('manage')
            .setDescription('Manage or remove an existing collection feed in this server.')
            .addNumberOption(option => 
                option.setName('id')
                .setDescription('The ID of the existing feed.')
                .setRequired(false)
            )
        )
    )
    .addSubcommandGroup(scg =>
        scg.setName('games')
        .setDescription('Game Feed Management.')
        .addSubcommand(sc =>
            sc.setName('create')
            .setDescription('Create a game feed in this channel.')
            .addStringOption(option => 
                option.setName('game')
                .setDescription('The game name or domain ID')
                .setRequired(true)
            ) 
        )
        .addSubcommand(sc =>
            sc.setName('manage')
            .setDescription('Manage or remove an existing game feed in this server.')
            .addNumberOption(option => 
                option.setName('id')
                .setDescription('The ID of the existing feed (Optional).')
                .setRequired(false)
            )  
        )
    )
    .addSubcommandGroup(scg =>
        scg.setName('mods')
        .setDescription('Mod Feed Management.')
        .addSubcommand(sc =>
            sc.setName('create')
            .setDescription('Create a mod feed in this channel.')
            .addStringOption(option => 
                option.setName('url')
                .setDescription('The link to the Mod page.')
                .setRequired(true)
            ) 
        )
        .addSubcommand(sc =>
            sc.setName('manage')
            .setDescription('Manage or remove an existing mod feed in this server.')
            .addNumberOption(option => 
                option.setName('id')
                .setDescription('The ID of the existing feed.')
                .setRequired(false)
            )   
        )
    )
    .addSubcommand(sc => 
        sc.setName('list')
        .setDescription('List all feeds for this server.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,
    public: false,
    guilds: ['581095546291355649'],
    aliases: [ 'modfeed', 'collectionfeed' ],
    action
}

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId: Snowflake = interaction.user.id;
    await interaction.deferReply({ ephemeral: true }).catch(err => { throw err });

    if (!interaction.memberPermissions?.toArray().includes('ManageChannels')) {
        // User is not a moderator. 
        await interaction.editReply('Gamefeeds can only be created or managed by server moderators with the "Manage Channels" permission.');
        return logMessage('Permission to create gamefeed denied', { user: interaction.user.tag, guild: interaction.guild?.name });
    }

    const userData: DiscordBotUser|undefined = await getUserByDiscordId(discordId);

    // Check the user's Authorisation
    if (!userData) return interaction.editReply({ content: 'Please use /link to connect your Nexus Mods account before creating a feed.' });
    try {
        await userData.NexusMods.Auth();
    }
    catch(err) {
        return interaction.editReply({ content: 'There was an issue authorising your Nexus Mods account, please use /link to update your token.' });
    }

    // Pull the data we need from the user input
    const type: FeedType | null = interaction.options.getSubcommandGroup() as FeedType;
    const subCommand: InteractionType = interaction.options.getSubcommand(true) as InteractionType;
    if (!type) {
        switch (subCommand) {
            case 'about': return aboutFeeds(client, interaction);
            case 'list': return listFeeds(client, interaction);
        }
    };
    const id: number | null = interaction.options.getNumber('id');
    const url: string | null = interaction.options.getString('url');
    const game: string | null = interaction.options.getString('game');

    switch(type) {
        case 'collections' : return subCommand === 'create' ? newCollectionFeed(url!, interaction) : manageFeed('collections', id!, interaction);
        case 'games' : return subCommand === 'create' ? newGameFeed(game!, interaction) : manageFeed('games', id!, interaction);
        case 'mods' : return subCommand === 'create' ? newModFeed(url!, interaction) : manageFeed('mods', id!, interaction);
        default: return interaction.editReply('Unknown SubCommandGroup!').catch(() => null);
    }
}

async function aboutFeeds(client: Client, interaction: ChatInputCommandInteraction): Promise<any> {
    const aboutEmbed = new EmbedBuilder()
    .setTitle('About Feeds')
    .setDescription("Using this feature you can create a feed in this channel which will periodically post updates for the game, mod or collection of your choice."+
    "\n\nTo set up the feed use the create command `/feed {type} create` command."+
    "\n\nBy default adult content will only be included if the channel is marked NSFW in Discord.")
    .addFields([
        {
            name: 'Editing or Cancelling Feeds',
            value: 'To edit an existing feed, use `/feeds {type} manage id:` followed by the number reference of your feed e.g. /feed {type} manage id:117.',
        },
        {
            name: 'Listing Active Game Feeds',
            value: 'To view a list of feeds in the current server, use the manage command without providing an id.'
        }
    ])
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });

    return interaction.editReply({ content: null, embeds: [aboutEmbed] });
}

async function listFeeds(client: Client, interaction: ChatInputCommandInteraction): Promise<any> {
    const guildId = interaction.guildId;
    const gameFeeds: GameFeed[] = guildId ? await getGameFeedsForServer(guildId) : [];
    const modFeeds: ModFeed[] = []//guildId ? await getModFeedsForServer(guildId) : [];
    const collectionFeeds: CollectionFeed[] = []//guildId ? await getModFeedsForServer(guildId) : [];
    const feeds: Feed[] = [ ...gameFeeds, ...modFeeds, ...collectionFeeds ];
    const displayableFeeds = feeds.slice(0, 23);
    
    const feedFieldData: APIEmbedField[] = displayableFeeds.map(f => {
        if (f.isGameFeed()) return {
            name: `${f.title} - GAME - (Feed ID: ${f._id})`,
            value: `Created by ${interaction.guild?.members.resolve(f.owner)?.toString() || '*Unknown*'} in <#${f.channel}>\n`+
            `**New Mods**: ${f.show_new ? 'Show' : 'Hide' } | **Updated Mods**: ${f.show_updates ? 'Show' : 'Hide' }\n`+
            `**Adult Content**: ${f.nsfw ? 'Show' : 'Hide' } | **Non-Adult Content**: ${f.sfw ? 'Show' : 'Hide' }\n`
        }
        else if (f.isModFeed()) return {
            name: `${f.title} - MOD - (Feed ID: ${f._id})`,
            value: `Created by ${interaction.guild?.members.resolve(f.owner)?.toString() || '*Unknown*'} in <#${f.channel}>\n`+
            `[View Mod](https://nexusmods.com/${f.domain}/mods/${f.mod_id})' }\n`
        }
        else if (f.isCollectionFeed()) return {
            name: `${f.title} - COLLECTION - (Feed ID: ${f._id})`,
            value: `Created by ${interaction.guild?.members.resolve(f.owner)?.toString() || '*Unknown*'} in <#${f.channel}>\n`+
            `[View Collection](https://next.nexusmods.com/${f.domain}/collections/${f.slug})' }\n`
        }
        else return { name: `${f.title} - Unknown - (Feed ID: ${f._id})`, value: 'Unknown feed type!' }
    })
    
    const embed: EmbedBuilder = new EmbedBuilder()
    .setTitle(`Game Feeds in ${interaction.guild?.name || 'this server'} (${feeds.length})`)
    .setDescription('To edit an existing feed, use the `/feed` command and include the number reference of your feed e.g. /feed games manage id:1.')
    .setColor(0xda8e35)
    .addFields(feedFieldData)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });

    interaction.editReply({ content: null, embeds: [embed] });
}

async function newCollectionFeed(url: string, interaction: ChatInputCommandInteraction) {
    return interaction.editReply('Not yet implemented!');
}

async function newGameFeed(gameName: string , interaction: ChatInputCommandInteraction) {
    
}

async function newModFeed(url: string, interaction: ChatInputCommandInteraction) {
    return interaction.editReply('Not yet implemented!');
}

async function manageFeed(type: FeedType, id: number, interaction: ChatInputCommandInteraction) {
    if (type !== 'games') return interaction.editReply('Not yet implemented!');
}

export { discordInteraction };
