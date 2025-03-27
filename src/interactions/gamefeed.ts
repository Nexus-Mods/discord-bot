import { 
    CommandInteraction, Snowflake, EmbedBuilder, Client, 
    Interaction, Message, TextChannel, Webhook, Collection,
    ButtonBuilder, InteractionCollector, APIEmbedField, ChatInputCommandInteraction, 
    SlashCommandBuilder, ButtonStyle, ActionRowBuilder, ComponentType, ModalBuilder, ModalActionRowComponentBuilder, TextInputBuilder, TextInputStyle, ButtonInteraction, AutocompleteInteraction,
    MessageFlags
} from "discord.js";
import { DiscordInteraction } from "../types/DiscordTypes";
import { getUserByDiscordId, createGameFeed, getGameFeedsForServer, getGameFeed, deleteGameFeed, updateGameFeed } from '../api/bot-db';
import { logMessage } from '../api/util';
import { GameFeed } from "../types/feeds";
import { DiscordBotUser } from "../api/DiscordBotUser";
import { IGameStatic } from "../api/queries/other";
import { autocompleteGameName } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('gamefeed')
    .setDescription('Game Feeds post new or updated mods every 10 minutes.')
    .setDMPermission(false)
    .addSubcommand(subcommand => 
        subcommand.setName('about')
        .setDescription('Learn more about this feature.')
    )
    .addSubcommand(subcommand => 
        subcommand.setName('create')
        .setDescription('Create a Game Feed in this channel.')
        .addStringOption(option => 
            option.setName('game')
            .setDescription('The game name or domain ID')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName('list')
        .setDescription('List Game Feeds for this server.')
    )
    .addSubcommand(subcommand => 
        subcommand.setName('manage')
        .setDescription('Manage an existing Game Feed.')
        .addNumberOption(option => 
            option.setName('id')
            .setDescription('The ID of the existing feed.')
            .setRequired(true)
        )
        // .addStringOption(option => 
        //     option.setName('message')    
        //     .setDescription('Message to attach to Game Feed announcements.')
        //     .setRequired(false)
        // )
    ) as SlashCommandBuilder,
    public: true,
    guilds: [],
    action,
    autocomplete: autocompleteGameName,
}

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // logMessage('Gamefeed interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name, subCommand: interaction.options.getSubcommand() });
    const discordId: Snowflake = interaction.user.id;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(err => { throw err });;

    if (!interaction.memberPermissions?.toArray().includes('ManageChannels')) {
        // User is not a moderator. 
        await interaction.editReply('Gamefeeds can only be created or managed by server moderators with the "Manage Channels" permission.');
        return logMessage('Permission to create gamefeed denied', { user: interaction.user.tag, guild: interaction.guild?.name });
    }

    const userData: DiscordBotUser|undefined = await getUserByDiscordId(discordId);

    const interactionSubCommand = interaction.options.getSubcommand();

    switch (interactionSubCommand) {
        case 'about': return aboutGameFeeds(client, interaction, userData);
        case 'create': return createGameFeedDisabled(client, interaction, userData);
        case 'list' : return listFeeds(client, interaction, userData);
        case 'manage': return manageFeed(client, interaction, userData);
        default: await interaction.editReply('Unknown SubCommand!');
    }
}

async function aboutGameFeeds(client: Client, interaction: ChatInputCommandInteraction, user: DiscordBotUser|undefined): Promise<void> {
    const aboutEmbed = new EmbedBuilder()
    .setTitle('Game Feeds')
    .setDescription("Using this feature you can create a feed in this channel which will periodically report new and updated mods posted for the specfied game."+
    "\n\nTo set up the feed add the name or domain of the game to the `/gamefeed create` command e.g. \"Stardew Valley\" or \"stardewvalley\"."+
    "\n\nBy default adult content will only be included if the channel is marked NSFW in Discord."+
    "\n\n*The feed will use the API key linked to your account and can consume approximately 144 - 1500 requests per day depending on your settings and the number of mods posted.*")
    .addFields([
        {
            name: 'Editing or Cancelling Game Feeds',
            value: 'To edit an existing feed, use `/gamefeed manage id:` followed by the number reference of your feed e.g. /gamefeed manage 117.',
        },
        {
            name: 'Listing Active Game Feeds',
            value: 'To view a list of feeds in the current channel, use `/gamefeed list'
        }
    ])
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });

    interaction.editReply({ content: null, embeds: [aboutEmbed] });
}

async function createGameFeedDisabled(client: Client, interaction: ChatInputCommandInteraction, user: DiscordBotUser|undefined): Promise<any> {
    return rejectMessage('The game feeds feature is being deprecated, please use `/track` for new feeds.', interaction);
}

async function createFeed(client: Client, interaction: ChatInputCommandInteraction, user: DiscordBotUser|undefined): Promise<any> {
    if (!user) return rejectMessage('This feature requires a linked Nexus Mods account. See /link.', interaction);

    // Check the user's auth is valid.
    try {
        await user.NexusMods.Auth();
    }
    catch(err) {
        return rejectMessage(
            `There was a problem authorising your Nexus Mods account. Re-authorise at https://discordbot.nexusmods.com/linked-role`+
            `\n\n${(err as Error).message}`, 
            interaction
        );
    }

    const query: string = interaction.options.getString('game') || '';
    const nsfw: boolean = (interaction.channel as TextChannel)?.nsfw || false;

    try {
        // Find the game we're looking for
        const allGames = await user.NexusMods.API.Other.Games()//user.NexusMods.API.v2.Games();
        const game = allGames.find(g => [g.name.toLowerCase(), g.domain_name].includes(query.toLowerCase()));
        // Game not found!
        if (!game) throw new Error(`No matching games for ${query}`);

        // Bot permissions - we need to be able to manage webhooks.
        const perms = interaction.guild?.members?.me?.permissions?.toArray();
        const channelPerms = interaction.channel ? interaction.guild?.members?.me?.permissionsIn(interaction.channel as TextChannel).toArray() : [];
        if (!perms || (!perms.includes('ManageWebhooks') && !perms.includes('Administrator'))) {
            throw new Error('Missing permission: MANAGE_WEBHOOKS');
        }
        if (!channelPerms || (!channelPerms.includes('ManageWebhooks') && !channelPerms.includes('Administrator'))) {
            throw new Error('Missing channel permission: MANAGE_WEBHOOKS');
        }

        // Confirm with the user.
        const confirm: EmbedBuilder = confirmEmbed(client, interaction, game, user, nsfw);
        const buttons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                .setLabel('✅ Confirm')
                .setStyle(ButtonStyle.Primary)
                .setCustomId('confirm'),
                new ButtonBuilder()
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('cancel')
            )
        interaction.editReply({ content: null, embeds: [confirm], components: [buttons] });
        const replyMsg = await interaction.fetchReply();
        const collector: InteractionCollector<any> = (replyMsg as Message).createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });
        
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
            gameHook = webHooks.find(wh => wh.channelId === (interaction.channel as any)?.id && wh.name === 'Nexus Mods Game Feed' && !!wh.token);
            if (!gameHook) {
                // There isn't already a webhook for this channel, so we need to create one. 
                try {
                    gameHook = await (interaction.channel as TextChannel).createWebhook({ name: 'Nexus Mods Game Feed', avatar: client.user?.avatarURL() || '', reason: 'Game feed' });
                }
                catch(err) {
                    logMessage('Error creating webhook', {user: interaction.user.tag, guild: interaction.guild?.name, channel: interaction.channel?.toString(), err}, true);
                    throw new Error(`Failed to create Webhook for game feed. Please make sure the bot has the correct permissions.\n Error: ${(err as Error).message || err}`);
                }
            }

            const newFeed: Partial<GameFeed> = {
                channel: (interaction.channel as any)?.id,
                guild: interaction.guild?.id,
                owner: interaction.user.id,
                domain: game?.domain_name || '',
                title: game?.name || '',
                nsfw,
                sfw: true,
                show_new: true,
                show_updates: true,
                webhook_id: (gameHook as Webhook)?.id,
                webhook_token: gameHook?.token || undefined
            }

            try {
                logMessage('Creating new game feed', { game: game.name, guild: interaction.guild?.name });
                const id = await createGameFeed(newFeed);
                await interaction.editReply({ content: 'Game Feed created successfully', components: [], embeds: [] });
                logMessage('Game Feed Created', { id, game: game.name, guild: interaction.guild?.name, channel: (interaction.channel as TextChannel).name, owner: interaction.user.tag });
                const infoMsg = await interaction?.followUp({ content: '', embeds: [successEmbed(interaction, newFeed, game, id)], flags: MessageFlags.Ephemeral }).catch((err) => logMessage('Followup error', err, true));
                if (perms.includes('ManageMessages')) await (infoMsg as Message)?.pin().catch((err) => logMessage('Pinning post error', err, true));
                return;
            }
            catch(err) {
                throw err;
            }
        });

        collector?.on('end', async rc => {
            if (!rc.size) interaction.editReply({ content: 'Game feed setup cancelled.', embeds: [], components: [] }).catch(() => undefined);
        });
    }
    catch(err) {
        if (!(err as Error).message?.startsWith('No matching games')) logMessage('Error creating game feed', {err}, true);
        rejectMessage((err as any).message || err, interaction);
    }
}

async function listFeeds(client: Client, interaction: CommandInteraction, user: DiscordBotUser|undefined): Promise<void> {
    const guildId = interaction.guildId;
    const feeds: GameFeed[] = guildId ? await getGameFeedsForServer(guildId) : [];
    const displayableFeeds = feeds.slice(0, 23);
    
    const feedFieldData: APIEmbedField[] = displayableFeeds.map(f => {
        return {
            name: `${f.title} - (Feed ID: ${f._id})`,
            value: `Created by ${interaction.guild?.members.resolve(f.owner)?.toString() || '*Unknown*'} in <#${f.channel}>\n`+
            `**New Mods**: ${f.show_new ? 'Show' : 'Hide' } | **Updated Mods**: ${f.show_updates ? 'Show' : 'Hide' }\n`+
            `**Adult Content**: ${f.nsfw ? 'Show' : 'Hide' } | **Non-Adult Content**: ${f.sfw ? 'Show' : 'Hide' }\n`
        }
    })
    
    const embed: EmbedBuilder = new EmbedBuilder()
    .setTitle(`Game Feeds in ${interaction.guild?.name || 'this server'} (${feeds.length})`)
    .setDescription('To edit an existing feed, use the `/gamefeed manage` command and include the number reference of your feed e.g. /gamefeed manage id:1.')
    .setColor(0xda8e35)
    .addFields(feedFieldData)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });

    interaction.editReply({ content: null, embeds: [embed] });
}

async function manageFeed(client: Client, interaction: ChatInputCommandInteraction, user: DiscordBotUser|undefined): Promise<void> {
    if (!user) return rejectMessage('This feature requires a linked Nexus Mods account. See /link.', interaction);

    // Check the user's auth is valid.
    try {
        await user.NexusMods.Auth();
    }
    catch(err) {
        return rejectMessage(
            `There was a problem authorising your Nexus Mods account. Re-authorise at https://discordbot.nexusmods.com/linked-role`+
            `\n\n${(err as Error).message}`, 
            interaction
        );
    }

    const feedId = interaction.options.getNumber('id');

    try {
        if (!feedId) throw new Error('Feed ID is invalid.');
        // Find the feed.
        const feed: GameFeed = await getGameFeed(feedId);
        if (!feed) throw new Error(`Feed ${feedId} not found.`);
        // Check they can edit it
        if (feed.guild !== interaction.guildId) throw new Error(`Feed ${feedId} can only be edited in the server it was created in.`);

        // Create the buttons we need.
        const buttons = (feed: GameFeed, edits: Partial<GameFeed>): ActionRowBuilder<ButtonBuilder>[] => {
            return [new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                .setLabel(feed.show_new ? '🆕 Hide New' : '🆕 Show New')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('toggle-new'),
                new ButtonBuilder()
                .setLabel(feed.show_updates ? '⏫ Hide Updates' : '⏫ Show Updates')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('toggle-updates'),
                new ButtonBuilder()
                .setLabel(feed.nsfw ? '🔞 Hide Adult' : '🔞 Show Adult')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('toggle-nsfw'),
                new ButtonBuilder()
                .setLabel(feed.sfw ? '🕹 Hide Non-Adult' : '🕹 Show Non-Adult')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('toggle-sfw'),
                new ButtonBuilder()
                .setLabel(feed.compact ? '↕ Set Full Size' : '↕ Set Compact')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('toggle-compact'),
            ),
            new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                .setLabel('📣 Edit Message')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('newmessage')
            ),
            new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                .setLabel('Save')
                .setStyle(ButtonStyle.Primary)
                .setCustomId('save')
                .setDisabled(Object.keys(edits).length ? false : true),
                new ButtonBuilder()
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
                .setCustomId('delete'),
                new ButtonBuilder()
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId('cancel'),
            )
            ]
        }

        const embed = (feed: GameFeed): EmbedBuilder => {
            return new EmbedBuilder()
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
            .addFields({name: 'Settings', 
                value: `🆕 Show new: ${feed.show_new} | ⏫ Show updates: ${feed.show_updates} | ↕ Compact Mode: ${feed.compact}\n`+
                `🔞 Adult Content: ${feed.nsfw} | 🕹 Safe Content: ${feed.sfw}`
            });

        }

        // Store the changes before applying them. 
        let newData: Partial<GameFeed> = {};

        // Update the embed/buttons
        await interaction.editReply(
            { 
                content: null, 
                embeds: [embed({...feed, ...newData})], 
                components: buttons({...feed,...newData}, newData) 
            });

        // Prepare the interaction collector.
        const replyMsg = await interaction.fetchReply();
        const collector: InteractionCollector<any> = (replyMsg as Message).createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

        collector.on('collect', async (i: ButtonInteraction) => {
            const id: string = i.customId;

            switch (id) {
                case 'cancel': return collector.stop('cancel');
                case 'save': return collector.stop('save');
                case 'delete': return collector.stop('delete');
                case 'toggle-new': {
                    await i.deferUpdate().catch(undefined);
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
                    await i.deferUpdate().catch(undefined);
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
                    await i.deferUpdate().catch(undefined);
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
                    await i.deferUpdate().catch(undefined)
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
                    await i.deferUpdate().catch(undefined)
                    newData.compact = !!newData.compact ? !newData.compact : !feed.compact;
                    await i.editReply(
                        { 
                            content: null, 
                            embeds: [embed({...feed, ...newData})], 
                            components: buttons({...feed,...newData}, newData) 
                        });
                    break;
                }
                case 'newmessage': {
                    const textbox = new TextInputBuilder()
                    .setCustomId('message-text')
                    .setLabel('Message to attach to Game Feed annoucements')
                    .setPlaceholder('Enter a message to be posted with updates to this game feed.')
                    .setValue(feed.message ?? '')
                    .setStyle(TextInputStyle.Short);

                    const input = new ActionRowBuilder<ModalActionRowComponentBuilder>()
                    .addComponents(textbox);

                    const modal = new ModalBuilder()
                    .setTitle('Edit Message')
                    .setCustomId('editMessage')
                    .addComponents(input)
                    await i.showModal(modal);
                    const modalSubmit = await i.awaitModalSubmit({ time: 15_000 });
                    await (modalSubmit as any).deferUpdate();
                    const newMsg = modalSubmit.fields.getTextInputValue('message-text');
                    newData.message = newMsg;
                    await i.editReply(
                        { 
                        content: null, 
                        embeds: [embed({...feed, ...newData})], 
                        components: buttons({...feed,...newData}, newData) 
                        }
                    ).catch(undefined);
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
                catch(err) {
                    logMessage(`Failed to update Game Feed #${feed._id}`, {err}, true);
                    rejectMessage('Unable to update Game Feed:\n'+((err as Error).message || err), interaction)
                }
            }
            else if (ic.find(i => i.customId === 'delete')) {
                try {
                    await deleteGameFeed(feed._id);
                    logMessage(`Game feed #${feed._id} for ${feed.title} in ${interaction.guild?.name} deleted by ${ic.first()?.user?.tag}`);
                    await interaction.editReply({ content: 'Game Feed deleted.', embeds: [], components: [] });
                }
                catch(err) {
                    logMessage(`Failed to delete Game Feed #${feed._id}`, {err}, true);
                    rejectMessage('Unable to delete Game Feed:\n'+((err as Error).message || err), interaction)
                }
            }
            else if (ic.find(i => i.customId === 'cancel')) await interaction.editReply({ content: 'Editing cancelled.', embeds: [embed(feed)], components: [] });
            else await interaction.editReply({ content: 'Editing timed out.', embeds: [embed(feed)], components: [] });
        });

    }
    catch(err) {
        logMessage('Game Feed management error', err, true);
        rejectMessage('Something went wrong when trying to manage the Game Feed.\n'+((err as Error).message || err), interaction);
    }
}

const confirmEmbed = (client: Client, interaction: Interaction, game: IGameStatic, user: DiscordBotUser, nsfw: boolean): EmbedBuilder => {
    return new EmbedBuilder()
    .setColor(0xda8e35)
    .setTitle(`Create game feed in #${(interaction.channel as any).name}?`)
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`)
    .setDescription(
        `New and updated mods for ${game.name} will be posted in ${interaction.channel?.toString()} periodically.\n`+
        `Adult content ${nsfw ? "will" : "will not"} be included.\n`+
        `The API key for ${user.NexusModsUsername} will be used.`
    )
    .setFooter({ text: `Nexus Mods API link`, iconURL: client.user?.avatarURL() || '' })
}

const successEmbed = (interaction: Interaction, feed: Partial<GameFeed>, game: IGameStatic, id: number): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle(`Mods for ${feed.title} will be posted in this channel`)
    .setColor(0xda8e35)
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game?.id}.jpg`)
    .setFooter({text: `Feed ID: #${id} - Created by: ${interaction.user.tag}` })
    .setTimestamp(new Date());
}

async function rejectMessage(reason: string,  interaction: CommandInteraction) {
    const rejectEmbed = new EmbedBuilder()
    .setColor('DarkRed')
    .setTitle('Error accessing Game Feeds')
    .setDescription(reason)

    await interaction.editReply({ content: null, embeds: [rejectEmbed], components: [] });
}


export { discordInteraction };
