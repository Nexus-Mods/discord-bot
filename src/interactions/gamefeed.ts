import { 
    CommandInteraction, Snowflake, MessageEmbed, Client, 
    Interaction, Message, TextChannel, Webhook, Collection,
    MessageActionRow, MessageButton, InteractionCollector, EmbedFieldData
} from "discord.js";
import { NexusUser } from "../types/users";
import { DiscordInteraction } from "../types/util";
import { getUserByDiscordId, createGameFeed, getGameFeedsForServer, getGameFeed, deleteGameFeed, updateGameFeed } from '../api/bot-db';
import { games } from '../api/nexus-discord';
import { logMessage } from '../api/util';
import { IGameInfo } from "@nexusmods/nexus-api";
import { GameFeed } from "../types/feeds";

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'gamefeed',
        description: 'Game Feeds post new or updated mods every 10 minutes.',
        options: [
            {
                name: 'about',
                type: 'SUB_COMMAND',
                description: 'Learn more about this feature.'
            },
            {
                name: 'create',
                type: 'SUB_COMMAND',
                description: 'Create a Game Feed in this channel.',
                options: [
                    {
                        name: 'game',
                        description: 'The game name or domain ID',
                        type: 'STRING',
                        required: true
                    }
                ]
            },
            {
                name: 'list',
                type: 'SUB_COMMAND',
                description: 'List Game Feeds for this server',
            },
            {
                name: 'manage',
                type: 'SUB_COMMAND',
                description: 'Manage an existing Game Feed',
                options: [
                    {
                        name: 'id',
                        type: 'NUMBER',
                        description: 'The ID of the existing feed',
                        required: true
                    },
                    {
                        name: 'message',
                        type: 'STRING',
                        description: 'Message to attach to Game Feed annoucements',
                        required: false
                    }
                ]
            }
        ]
    },
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<void> {
    const discordId: Snowflake = interaction.user.id;
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.memberPermissions?.toArray().includes('MANAGE_CHANNELS')) {
        // User is not a moderator. 
        await interaction.editReply('Gamefeeds can only be created or managed by server moderators with the "Manage Channels" permission.');
        return logMessage('Permission to create gamefeed denied', { user: interaction.user.tag, guild: interaction.guild?.name });
    }

    const userData: NexusUser = await getUserByDiscordId(discordId);

    const interactionSubCommand = interaction.options.getSubcommand();

    switch (interactionSubCommand) {
        case 'about': return aboutGameFeeds(client, interaction, userData);
        case 'create': return createFeed(client, interaction, userData);
        case 'list' : return listFeeds(client, interaction, userData);
        case 'manage': return manageFeed(client, interaction, userData);
        default: await interaction.editReply('Unknown SubCommand!');
    }
}

async function aboutGameFeeds(client: Client, interaction: CommandInteraction, user: NexusUser): Promise<void> {
    const aboutEmbed = new MessageEmbed()
    .setTitle('Game Feeds')
    .setDescription("Using this feature you can create a feed in this channel which will periodically report new and updated mods posted for the specfied game."+
    "\n\nTo set up the feed add the name or domain of the game to the `/gamefeed create` command e.g. \"Stardew Valley\" or \"stardewvalley\"."+
    "\n\nBy default adult content will only be included if the channel is marked NSFW in Discord."+
    "\n\n*The feed will use the API key linked to your account and can consume approximately 144 - 1500 requests per day depending on your settings and the number of mods posted.*")
    .addField('Editing or Cancelling Game Feeds', 'To edit an existing feed, use `/gamefeed manage id:` followed by the number reference of your feed e.g. /gamefeed manage 117.')
    .addField('Listing Active Game Feeds', 'To view a list of feeds in the current channel, use `/gamefeed list`.')
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });

    interaction.editReply({ content: null, embeds: [aboutEmbed] });
}

async function createFeed(client: Client, interaction: CommandInteraction, user: NexusUser): Promise<void> {
    if (!user) return rejectMessage('This feature requires a linked Nexus Mods account. See /link.', interaction);

    const query: string = interaction.options.getString('game') || '';
    const nsfw: boolean = (interaction.channel as TextChannel)?.nsfw || false;

    try {
        // Find the game we're looking for
        const allGames: IGameInfo[] = await games(user);
        const game: IGameInfo | undefined = allGames.find(g => [g.name.toLowerCase(), g.domain_name].includes(query));
        // Game not found!
        if (!game) throw new Error(`No matching games for ${query}`);

        // Confirm with the user.
        const confirm: MessageEmbed = confirmEmbed(client, interaction, game, user, nsfw);
        const buttons: MessageActionRow = new MessageActionRow()
            .addComponents(
                new MessageButton({
                    label: '✅ Confirm',
                    style: 'PRIMARY',
                    customId: 'confirm'
                }),
                new MessageButton({
                    label: '❌ Cancel',
                    style: 'SECONDARY',
                    customId: 'cancel'
                })
            )
        interaction.editReply({ content: null, embeds: [confirm], components: [buttons] });
        const replyMsg = await interaction.fetchReply();
        const collector: InteractionCollector<any> = (replyMsg as Message).createMessageComponentCollector({ componentType: 'BUTTON', time: 15000 });
        
        collector.on('collect', async (i) => {
            await i.deferUpdate().catch(undefined);
            // Cancel
            if (i.customId === 'cancel') {
                collector.stop('User cancelled.');
                await interaction.editReply({ content: 'Game feed setup cancelled.', embeds: [], components: [] });
                return;
            }
            // Create
            let gameHook: Webhook | void;
            const webHooks: Collection<Snowflake, Webhook> = await (interaction.channel as TextChannel)?.fetchWebhooks().catch(() => new Collection()) || new Collection();
            const existing: Webhook|undefined = webHooks.find(wh => wh.channelId === interaction.channel?.id && wh.name === 'Nexus Mods Game Feed' && !!wh.token);
            if (!existing) {
                gameHook = await (interaction.channel as TextChannel).createWebhook('Nexus Mods Game Feed', { avatar: client.user?.avatarURL() || '', reason: 'Game feed'} )
                .catch((err) => logMessage('Error creating webhook', {err}, true))
            }
            else gameHook = existing;

            const newFeed: Partial<GameFeed> = {
                channel: interaction.channel?.id || '',
                guild: interaction.guild?.id || '',
                owner: interaction.user.id,
                domain: game?.domain_name || '',
                title: game?.name || '',
                nsfw,
                sfw: true,
                show_new: true,
                show_updates: true,
                webhook_id: gameHook?.id,
                webhook_token: gameHook?.token || undefined
            }

            try {
                logMessage('Creating new game feed', { game: game.name, guild: interaction.guild?.name });
                const id = await createGameFeed(newFeed);
                await interaction.editReply({ content: 'Game Feed created successfully', components: [], embeds: [] });
                logMessage('Game Feed Created', { id, game: game.name, guild: interaction.guild?.name, channel: (interaction.channel as TextChannel).name, owner: interaction.user.tag });
                const infoMsg = await interaction?.followUp({ content: null, embeds: [successEmbed(interaction, newFeed, game, id)], ephemeral: false }).catch(() => undefined);
                await (infoMsg as Message)?.pin().catch(undefined);
                return;
            }
            catch(err) {
                throw err;
            }
        });

        collector?.on('end', async rc => {
            if (!rc.size) interaction.editReply({ content: 'Game feed setup cancelled.', embeds: [] }).catch(() => undefined);
        });
    }
    catch(err) {
        logMessage('Error creating game feed', {err}, true);
        rejectMessage((err as any).message || err, interaction);
    }
}

async function listFeeds(client: Client, interaction: CommandInteraction, user: NexusUser): Promise<void> {
    const guildId = interaction.guildId;
    const feeds: GameFeed[] = guildId ? await getGameFeedsForServer(guildId) : [];
    const displayableFeeds = feeds.slice(0, 23);
    
    const feedFieldData: EmbedFieldData[] = displayableFeeds.map(f => {
        return {
            name: `${f.title} - (Feed ID: ${f._id})`,
            value: `Created by ${interaction.guild?.members.resolve(f.owner)?.toString() || '*Unknown*'} in <#${f.channel}>\n`+
            `**New Mods**: ${f.show_new ? 'Show' : 'Hide' } | **Updated Mods**: ${f.show_updates ? 'Show' : 'Hide' }\n`+
            `**Adult Content**: ${f.nsfw ? 'Show' : 'Hide' } | **Non-Adult Content**: ${f.sfw ? 'Show' : 'Hide' }\n`
        }
    })
    
    const embed: MessageEmbed = new MessageEmbed()
    .setTitle(`Game Feeds in ${interaction.guild?.name || 'this server'} (${feeds.length})`)
    .setDescription('To edit an existing feed, use the `/gamefeed manage` command and include the number reference of your feed e.g. /gamefeed manage id:1.')
    .setColor(0xda8e35)
    .addFields(feedFieldData)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });

    interaction.editReply({ content: null, embeds: [embed] });
}

async function manageFeed(client: Client, interaction: CommandInteraction, user: NexusUser): Promise<void> {
    if (!user) return rejectMessage('This feature requires a linked Nexus Mods account. See /link.', interaction);

    const feedId = interaction.options.getNumber('id');
    const newMessage = interaction.options.getString('message')

    try {
        if (!feedId) throw new Error('Feed ID is invalid.');
        // Find the feed.
        const feed: GameFeed = await getGameFeed(feedId);
        if (!feed) throw new Error(`Feed ${feedId} not found.`);
        // Check they can edit it
        if (feed.guild !== interaction.guildId) throw new Error(`Feed ${feedId} can only be edited in the server it was created in.`);

        // Create the buttons we need.
        const buttons = (feed: GameFeed, edits: Partial<GameFeed>): MessageActionRow[] => {
            return [new MessageActionRow()
            .addComponents(
                new MessageButton({
                    label: feed.show_new ? '🆕 Hide New' : '🆕 Show New',
                    style: 'SECONDARY',
                    customId: 'toggle-new'
                }),
                new MessageButton({
                    label: feed.show_updates ? '⏫ Hide Updates' : '⏫ Show Updates',
                    style: 'SECONDARY',
                    customId: 'toggle-updates'
                }),
                new MessageButton({
                    label: feed.nsfw ? '🔞 Hide Adult' : '🔞 Show Adult',
                    style: 'SECONDARY',
                    customId: 'toggle-nsfw'
                }),
                new MessageButton({
                    label: feed.sfw ? '🕹 Hide Non-Adult' : '🕹 Show Non-Adult',
                    style: 'SECONDARY',
                    customId: 'toggle-sfw'
                }),
                new MessageButton({
                    label: feed.compact ? '↕ Set Full Size' : '↕ Set Compact',
                    style: 'SECONDARY',
                    customId: 'toggle-compact'
                }),
            ),
            new MessageActionRow()
            .addComponents(
                new MessageButton({
                    label: 'Save',
                    style: 'PRIMARY',
                    customId: 'save',
                    disabled: Object.keys(edits).length ? false : true,
                }),
                new MessageButton({
                    label: 'Delete',
                    style: 'DANGER',
                    customId: 'delete'
                }),
                new MessageButton({
                    label: 'Cancel',
                    style: 'SECONDARY',
                    customId: 'cancel'
                }),
            )
            ]
        }

        const embed = (feed: GameFeed): MessageEmbed => {
            return new MessageEmbed()
            .setTitle(`Editing GameFeed #${feed._id}`)
            .setColor(0xda8e35)
            .setTimestamp(feed.created)
            .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
            .setDescription(
                `Game: ${feed.title}\n`+
                `Channel: ${interaction.guild?.channels.resolve(feed.channel) || '*Unknown*'}\n`+
                `Created by: ${interaction.guild?.members.resolve(feed.owner)?.toString() || '*???*'}\n`+
                `Message: ${feed.message ? `"${feed.message}"` : '*Not set*'}.\n\n`+
                'To change the feed settings, use the buttons below. The message can be set when triggering this command.'
            )
            .addField('Settings', 
                `🆕 Show new: ${feed.show_new} | ⏫ Show updates: ${feed.show_updates} | ↕ Compact Mode: ${feed.compact}\n`+
                `🔞 Adult Content: ${feed.nsfw} | 🕹 Safe Content: ${feed.sfw}`
            );

        }

        // Store the changes before applying them. 
        let newData: Partial<GameFeed> = newMessage ? { message: newMessage } : {};

        // Update the embed/buttons
        await interaction.editReply(
            { 
                content: null, 
                embeds: [embed({...feed, ...newData})], 
                components: buttons({...feed,...newData}, newData) 
            });

        // Prepare the interaction collector.
        const replyMsg = await interaction.fetchReply();
        const collector: InteractionCollector<any> = (replyMsg as Message).createMessageComponentCollector({ componentType: 'BUTTON', time: 120000 });

        collector.on('collect', async i => {
            const id: string = i.customId;

            await i.deferUpdate().catch(undefined);

            switch (id) {
                case 'cancel': return collector.stop('cancel');
                case 'save': return collector.stop('save');
                case 'delete': return collector.stop('delete');
                case 'toggle-new': {
                    newData.show_new = !!newData.show_new ? !newData.show_new : !feed.show_new;
                    await i.editReply(
                        { 
                            content: null, 
                            embeds: [embed({...feed, ...newData})], 
                            components: buttons({...feed,...newData}, newData) 
                        });
                    break;
                }
                case 'toggle-updates': {
                    newData.show_updates = !!newData.show_updates ? !newData.show_updates : !feed.show_updates;
                    await i.editReply(
                        { 
                            content: null, 
                            embeds: [embed({...feed, ...newData})], 
                            components: buttons({...feed,...newData}, newData) 
                        });
                    break;
                }
                case 'toggle-nsfw': {
                    newData.nsfw = !!newData.nsfw ? !newData.nsfw : !feed.nsfw;
                    await i.editReply(
                        { 
                            content: null, 
                            embeds: [embed({...feed, ...newData})], 
                            components: buttons({...feed,...newData}, newData) 
                        });
                    break;
                }
                case 'toggle-sfw': {
                    newData.sfw = !!newData.sfw ? !newData.sfw : !feed.sfw;
                    await i.editReply(
                        { 
                            content: null, 
                            embeds: [embed({...feed, ...newData})], 
                            components: buttons({...feed,...newData}, newData) 
                        });
                    break;
                }
                case 'toggle-compact': {
                    newData.compact = !!newData.compact ? !newData.compact : !feed.compact;
                    await i.editReply(
                        { 
                            content: null, 
                            embeds: [embed({...feed, ...newData})], 
                            components: buttons({...feed,...newData}, newData) 
                        });
                    break;
                }
                default: logMessage('Missed all cases for button press', undefined, true);
            }

        });

        collector.on('end', async ic => {
            if (ic.find(i => i.customId === 'save')) {
                try {
                    if (Object.keys(newData).length) {
                        await updateGameFeed(feed._id, newData);
                        logMessage(`Game feed #${feed._id} for ${feed.title} in ${interaction.guild?.name} edited by ${ic.first()?.user?.tag}`);                    
                    }
                    await interaction.editReply({ content: 'Game Feed updated.', embeds: [embed({...feed, ...newData})], components: [] });
                }
                catch(err: any) {
                    logMessage(`Failed to update Game Feed #${feed._id}`, {err}, true);
                    rejectMessage('Unable to update Game Feed:\n'+(err.message || err), interaction)
                }
            }
            else if (ic.find(i => i.customId === 'delete')) {
                try {
                    await deleteGameFeed(feed._id);
                    logMessage(`Game feed #${feed._id} for ${feed.title} in ${interaction.guild?.name} deleted by ${ic.first()?.user?.tag}`);
                    await interaction.editReply({ content: 'Game Feed deleted.', embeds: [], components: [] });
                }
                catch(err: any) {
                    logMessage(`Failed to delete Game Feed #${feed._id}`, {err}, true);
                    rejectMessage('Unable to delete Game Feed:\n'+(err.message || err), interaction)
                }
            }
            else if (ic.find(i => i.customId === 'cancel')) await interaction.editReply({ content: 'Editing cancelled.', embeds: [embed(feed)], components: [] });
            else await interaction.editReply({ content: 'Editing timed out.', embeds: [embed(feed)], components: [] });
        });





    }
    catch(err: any) {
        logMessage('Game Feed management error', err, true);
        rejectMessage('Something went wrong when trying to manage the Game Feed.\n'+(err.message || err), interaction);
    }
}

const confirmEmbed = (client: Client, interaction: Interaction, game: IGameInfo, user: NexusUser, nsfw: boolean): MessageEmbed => {
    return new MessageEmbed()
    .setColor(0xda8e35)
    .setTitle(`Create game feed in #${(interaction.channel as TextChannel).name}?`)
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`)
    .setDescription(
        `New and updated mods for ${game.name} will be posted in ${interaction.channel?.toString()} periodically.\n`+
        `Adult content ${nsfw ? "will" : "will not"} be included.\n`+
        `The API key for ${user.name} will be used.`
    )
    .setFooter({ text: `Nexus Mods API link`, iconURL: client.user?.avatarURL() || '' })
}

const successEmbed = (interaction: Interaction, feed: Partial<GameFeed>, game: IGameInfo, id: number): MessageEmbed => {
    return new MessageEmbed()
    .setTitle(`Mods for ${feed.title} will be posted in this channel`)
    .setColor(0xda8e35)
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game?.id}.jpg`)
    .setFooter({text: `Feed ID: #${id} - Created by: ${interaction.user.tag}` })
    .setTimestamp(new Date());
}

async function rejectMessage(reason: string,  interaction: CommandInteraction) {
    const rejectEmbed = new MessageEmbed()
    .setColor('DARK_RED')
    .setTitle('Error accessing Game Feeds')
    .setDescription(reason)

    await interaction.editReply({ content: null, embeds: [rejectEmbed], components: [] });
}


export { discordInteraction };
