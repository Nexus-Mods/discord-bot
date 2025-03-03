import { 
    CommandInteraction, ActionRowBuilder, Client, EmbedBuilder, Message, 
    ButtonBuilder, TextChannel, EmbedField, ButtonInteraction, ChatInputCommandInteraction, 
    SlashCommandBuilder, PermissionFlagsBits, ButtonStyle, ComponentType, APIEmbedField,
    MessageFlags, 
} from "discord.js";
import { customEmojis } from "../types/util";
import { DiscordInteraction } from '../types/DiscordTypes';
import { getUserByDiscordId, getServer, editTip } from '../api/bot-db';
import Fuse from 'fuse.js';
import { logMessage, nexusModsTrackingUrl } from "../api/util";
import { CollectionsUserFilter } from "../types/GQLTypes";
import { BotServer } from "../types/servers";
import { sendUnexpectedError } from '../events/interactionCreate';
import { DiscordBotUser } from "../api/DiscordBotUser";
import { ICollection, IMod } from "../api/queries/v2";
import { IUser } from "../api/queries/v2-finduser";
import { IModResults } from "../api/queries/v2-mods";
import { IGameStatic } from "../api/queries/other";


const numberEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

const options: Fuse.IFuseOptions<any> = {
    shouldSort: true,
    findAllMatches: true,
    threshold: 0.4,
    location: 0,
    distance: 7,
    minMatchCharLength: 6,
    keys: [
        {name: "name", weight: 0.1},
        {name: "id", weight: 0.6},
        {name: "domain_name", weight: 0.3}
    ]
}

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Quickly search for games, mods or users.')
    .setDMPermission(true)
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand(sc => 
        sc.setName('mods')
        .setDescription('Search for mods on Nexus Mods') 
        .addStringOption(modtitle => 
            modtitle.setName('query')
            .setDescription('Search by mod title.')
            .setRequired(true)
        )
        .addStringOption(gameTitle => 
            gameTitle.setName('game-title')
            .setDescription('Select a game by title or domain name. e.g. Fallout New Vegas or newvegas')
            .setRequired(false)
        )
        .addBooleanOption(hide => 
            hide.setName('private')
            .setDescription('Should the result only be shown to just you? Default: FALSE')
            .setRequired(false)
        )
    )
    .addSubcommand(sc => 
        sc.setName('collections')
        .setDescription('Search for collections')
        .addStringOption(colTitle =>
            colTitle.setName('query')
            .setDescription('Search by collection title, summary or description')
            .setRequired(true)
        )
        .addStringOption(gameTitle => 
            gameTitle.setName('game-query')
            .setDescription('Select a game by title or domain name. e.g. Fallout New Vegas or newvegas')
            .setRequired(false)
        )
        .addBooleanOption(hide => 
            hide.setName('private')
            .setDescription('Should the result only be shown to just you? Default: FALSE')
            .setRequired(false)
        )
    )
    .addSubcommand(sc => 
        sc.setName('games')  
        .setDescription('Search for games on Nexus Mods')  
        .addStringOption(gameTitle => 
            gameTitle.setName('query')
            .setDescription('Select a game by title or domain name. e.g. Fallout New Vegas or newvegas')
            .setRequired(true)
        )
        .addBooleanOption(hide => 
            hide.setName('private')
            .setDescription('Should the result only be shown to just you? Default: FALSE')
            .setRequired(false)
        ) 
    )
    .addSubcommand(sc => 
        sc.setName('users')    
        .setDescription('Search for users on Nexus Mods') 
        .addStringOption(gameTitle => 
            gameTitle.setName('query')
            .setDescription('Enter the username to look up. Exact matches only.')
            .setRequired(false)
        )
        .addNumberOption(no => 
            no.setName('id')
            .setDescription('Enter the user ID to look up.')
            .setRequired(false)
        )
        .addBooleanOption(hide => 
            hide.setName('private')
            .setDescription('Should the result only be shown to just you? Default: FALSE')
            .setRequired(false)
        )
    ) as SlashCommandBuilder,
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

interface IModFieldResult {
    id: string;
    mod: IMod;
    game: IGameStatic|undefined;
}

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // logMessage('Search interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: interaction.channel?.toString() });

    const searchType: string = interaction.options.getSubcommand(true).toUpperCase();
    
    const query: string = interaction.options.getString('query') || '';
    const gameQuery : string = interaction.options.getString('game-query') || '';
    const showToAll: boolean = interaction.options.getBoolean('private') || false;
    const userId: number = interaction.options.getNumber('id') || 0;

    if (!searchType) return interaction.reply({ content:'Invalid search parameters', ephemeral: true });


    await interaction.deferReply({ ephemeral: true }).catch(err => { throw err });;

    const user: DiscordBotUser|undefined = await getUserByDiscordId(interaction.user.id);
    const server: BotServer | null = interaction.guild ? await getServer(interaction?.guild) : null;

    try {
        if (user) await user.NexusMods.Auth();
        else throw new Error('No account link exists');
    }
    catch(err) {
        logMessage('Search cancelled, no account link or invalid token', { err, user: user?.NexusModsUsername, discord: interaction.user.tag });
        return interaction.editReply({ embeds: [searchCancelled()] });
    }

    switch(searchType) {
        case 'MODS' : return searchMods(query, gameQuery, showToAll, client, interaction, user, server);
        case 'GAMES' : return searchGames(query, showToAll, client, interaction, user, server);
        case 'USERS' : return searchUsers(query, userId, showToAll, client, interaction, user, server);
        case 'COLLECTIONS' : return searchCollections(query, gameQuery, showToAll, client, interaction, user, server);
        default: return interaction.followUp('Search error: Invalid search type.');
    }
}

async function searchCollections(query: string, gameQuery: string, ephemeral:boolean, client: Client, interaction: ChatInputCommandInteraction, user: DiscordBotUser, server: BotServer|null) {
    logMessage('Collection search', {query, gameQuery, user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name});

    const allGames: IGameStatic[] = user ? await user.NexusMods.API.Other.Games().catch(() => []) : [];
    let gameIdFilter: number = parseInt(server?.game_filter ?? '0') || 0;

    if (gameQuery !== '' && allGames.length) {
        // logMessage('Searching for game in mod search', gameQuery);
        // Override the default server game filter. 
        const fuse = new Fuse(allGames, options);

        const results: IGameStatic[] = fuse.search(gameQuery).map(r => r.item);
        if (results.length) {
            // logMessage('Found game in mod search', results[0].name);
            const closestMatch = results[0];
            gameIdFilter = closestMatch.id;
        }
    }


    const filterGame: IGameStatic|undefined = allGames.find(g => g.id === gameIdFilter);
    const nsfw: boolean = (interaction.channel as TextChannel).nsfw;

    try {
        const filters: CollectionsUserFilter = {
            'generalSearch' : {
                value: query,
                op: 'MATCHES'
            }
        }
        if (!!filterGame) filters.gameName ={ value: filterGame.name, op:'EQUALS' };
        const results = await user.NexusMods.API.v2.Collections(filters, { endorsements: { direction: 'DESC' } }, true);
        if (results.nodesCount === 0) {
            // No results
            const noResults: EmbedBuilder = new EmbedBuilder()
            .setTitle('Search complete')
            .setDescription(`No results for "${query}".\nTry using the [full search](${results.searchURL}) on the website.`)
            .setThumbnail(client.user?.avatarURL() || '')
            .setColor(0xda8e35);

            return interaction.editReply({ content: null, embeds:[noResults] });
        }
        else if (results.nodesCount === 1 && !!results.nodes?.[0]) {
            // One result only
            const res = results.nodes[0];
            const info: ICollection|undefined = await user.NexusMods.API.v2.Collection(res.slug, res?.game.domainName, nsfw);
            if (!info) throw new Error(`Could not retrieve collection data for ${res.game.domainName}\\${res.slug}`);
            const embed = collectionEmbed(client, info, nsfw);
            return postResult(interaction, embed, ephemeral);
        }
        else {
            // Multiple results
            const choices = results.nodes?.slice(0,5) || [];

            // Buttons for the search options
            const buttons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents( 
                choices.map(
                    (c, idx) => new ButtonBuilder()
                    .setLabel(numberEmoji[idx])
                    .setCustomId(c.slug)
                    .setStyle(ButtonStyle.Primary)
                )
            );

            const createCollectionField = (c: ICollection, idx: number): APIEmbedField => {
                return {
                    name: `${numberEmoji[idx]} - ${c.name}`,
                    value: `Game: ${c.game?.name} - Author: [${c.user?.name}](https://nexusmods.com/users/${c.user?.memberId}) - [View](https://next.nexusmods.com/${c.game?.domainName}/collections/${c.slug})`,
                    inline: false
                }
            }

            // Create the embed
            const multiResult = new EmbedBuilder()
            .setTitle('Search Results')
            .setColor(0xda8e35)
            .setThumbnail(`https://staticdelivery.nexusmods.com/images/News/14778_tile_1667225117.jpg`)
            .setDescription(
                `Showing the top **${choices.length}** collections for your query ([See all](${results.searchURL}))\n`+
                `**Query:** "${query}"\n`+
                `**Game:** ${filterGame?.name || '_Any_'}`
            )
            .addFields(choices.map(createCollectionField));
            
            // Post the result
            const reply: Message = await interaction.editReply({ embeds: [multiResult], components: [buttons] }) as Message;
            // Record button presses
            const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
            // respond to the collect event
            collector.on('collect', async (i: ButtonInteraction) => {
                collector.stop('Collected');
                await i.update({ components: [], fetchReply: true });
                const id = i.customId;
                const found: Partial<ICollection> = choices.find(c => c.slug === id)!;
                if (!found) {
                    interaction.editReply({ content: 'Search failed!', embeds:[], components: []});
                    return;
                }
                const collection = await  user.NexusMods.API.v2.Collection(found.slug!, found.game?.domainName!, true).catch(() => undefined);
                postResult(interaction, collectionEmbed(client, collection!, nsfw), ephemeral);
            });

            collector.on('end', ic => {
                if (!ic.size) ic.first()?.update({ components: [] });
            });
        }
    }
    catch(err) {
        logMessage('Failed collection search', err, true);
        interaction.editReply({ content: 'Error!'+((err as Error).message|| err) })
    }
}

async function searchMods(query: string, gameQuery: string, ephemeral:boolean, client: Client, interaction: ChatInputCommandInteraction, user: DiscordBotUser, server: BotServer|null) {
    logMessage('Mod search', {query, gameQuery, user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name});

    const allGames: IGameStatic[] = user ? await user.NexusMods.API.Other.Games().catch(() => []) : [];
    let gameIdFilter: number = parseInt(server?.game_filter || '0') || 0;

    if (!['', undefined, null].includes(gameQuery) && allGames.length) {
        // logMessage('Searching for game in mod search', gameQuery);
        // Override the default server game filter. 
        const fuse = new Fuse(allGames, options);

        const results: IGameStatic[] = fuse.search(gameQuery).map(r => r.item);
        if (results.length) {
            // logMessage('Found game in mod search', results[0].name);
            const closestMatch = results[0];
            gameIdFilter = closestMatch.id;
        }
    }


    const filterGame: IGameStatic|undefined = allGames.find(g => g.id === gameIdFilter);

    // Need to escape brackets as this breaks Markdown on mobile
    const safeSearchURL = (input?: string) => input ? input.replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`): undefined;

    // Search for mods
    try {
        const search: IModResults = await user.NexusMods.API.v2.Mods(query, (interaction.channel as TextChannel)?.nsfw, gameIdFilter);
        // const search: NexusSearchResult = await user.NexusMods.API.v1.ModQuickSearch(query, (interaction.channel as TextChannel)?.nsfw, gameIdFilter);
        if (!search.nodes.length) {
            // No results!
            const noResults: EmbedBuilder = new EmbedBuilder()
            .setTitle('Search Results')
            .setDescription(`No results for "${query}".\nTry using the [full search](${safeSearchURL(search.fullSearchUrl)}) on the website.`)
            .setThumbnail(client.user?.avatarURL() || '')
            .setColor(0xda8e35);

            return interaction.editReply({ content: null, embeds:[noResults] });
        }
        else if (search.nodes.length === 1) {
            // Single result
            const mod: IMod = search.nodes[0];
            // const mod: IMod|undefined  = user ? (await user.NexusMods.API.v2.Mod( res.game_name, res.mod_id ))?.[0] : undefined;
            const gameForMod: IGameStatic|undefined = filterGame || allGames.find(g => g.domain_name === mod.game.domainName);
            const singleResult = singleModEmbed(client, mod, gameForMod);
            postResult(interaction, singleResult, ephemeral);
        }
        else {
            // Multiple results
            const top5 = search.nodes.slice(0,5);
            const fields: IModFieldResult[] = top5.map(
                (mod, idx) => ({ id: numberEmoji[idx], mod, game: allGames.find(g => g.domain_name === mod.game.domainName) })
            );
            // Create the button row.
            const buttons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                top5.map((r, idx) => {
                    return  new ButtonBuilder()
                    .setCustomId(r.modId.toString())
                    .setLabel(numberEmoji[idx])
                    .setStyle(ButtonStyle.Primary)
                })
            );
            const multiResult = new EmbedBuilder()
            .setTitle('Search Results')
            .setColor(0xda8e35)
            .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${gameIdFilter}.jpg`)
            .setDescription(
                `Showing ${search.totalCount < 5 ? search.totalCount : 5} of ${search.totalCount} results ([See all](${search.fullSearchUrl || 'https://nexusmods.com/mods/'}))\n`+
                `Query: "${query}" - Adult content: ${(interaction.channel as TextChannel)?.nsfw}\n`+
                `${!!filterGame ? `Game: ${filterGame.name}` : null}`
            )
            .addFields(fields.map(createModResultField))
            if (!user) multiResult.addFields({ name: 'Get better results', value: 'Filter your search by game and get more mod info in your result by linking in your account. See `!nm link` for more.'});

            // Post the result
            const reply: Message = await interaction.editReply({ embeds: [multiResult], components: [buttons] }) as Message;
            // Record button presses
            const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

            collector.on('collect', async (i: ButtonInteraction) => {
                collector.stop('Collected');
                const reply = await i.update({ components: [], fetchReply: true });
                const id = i.customId;
                const found: IModFieldResult|undefined = fields.find(f => f.mod.modId.toString() === id);
                const mod = found?.mod;
                if (!mod) {
                    interaction.editReply({ content: 'Search failed!', embeds:[], components: []});
                    return;
                }
                postResult(interaction, singleModEmbed(client, mod, found?.game), ephemeral);
            });

            collector.on('end', ic => {
                if (!ic.size) ic.first()?.update({ components: [] });
            });


        }
    }
    catch(err) {
        logMessage('Mod Search failed!', {query, user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name, err}, true);
        await interaction.deleteReply().catch(() => undefined);
        return interaction.followUp({ content: 'Search failed!', embeds:[], components: [], ephemeral: true});
    }

}

async function searchGames(query: string, ephemeral:boolean, client: Client, interaction: ChatInputCommandInteraction, user: DiscordBotUser, server: BotServer|null) {
    logMessage('Game search', {query, user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name});
    if (!user) return interaction.followUp({ content: 'Please link your account to use this feature. See /link.', ephemeral: true });

    const allGames = await user.NexusMods.API.Other.Games().catch(() => []);
    const fuse = new Fuse(allGames, options);

    const results: IGameStatic[] = fuse.search(query).map(r => r.item);
    if (!results.length) return postResult(interaction, noGameResults(client, allGames, query), ephemeral);
    else if (results.length === 1) return postResult(interaction, oneGameResult(client, results[0]), ephemeral);
    else return postResult(interaction, multiGameResult(client, results, query), ephemeral);

}

async function searchUsers(query: string, userId: number, ephemeral: boolean, client: Client, interaction: ChatInputCommandInteraction, user: DiscordBotUser, server: BotServer|null) {
    logMessage('User search', {query, userId, user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name});
    if (!user) return interaction.followUp({ content: 'Please link your account to use this feature. See /link.', flags: ephemeral ? MessageFlags.Ephemeral: undefined });

    const invalidSearch = () => new EmbedBuilder()
    .setTitle('Invalid search')
    .setDescription(`Please provide a username or ID.`)
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });
    
    const noUserFound = () => new EmbedBuilder()
    .setTitle('No results found')
    .setDescription(`No users found for ${query ?? userId ?? 'NULL'}. This feature only supports exact matches so please check your spelling.`)
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });

    const userResult = (u: IUser) => new EmbedBuilder()
    .setAuthor({ name: u.name, url: `https://nexusmods.com/users/${u.memberId}` })
    .setDescription(`User ID: ${u.memberId}\n[View ${u.name}'s profile on Nexus Mods](https://nexusmods.com/users/${u.memberId})`)
    .addFields([ { name: 'Total Unique Mod Downloads', value: u.uniqueModDownloads.toLocaleString() } ])
    .setThumbnail(u.avatar)
    .setColor(0xda8e35)
    .setFooter({ text: `Nexus Mods - Requested by ${interaction.user.displayName}`, iconURL: client.user?.avatarURL() || '' });

    const searchTerm: string | number = query ?? userId;
    if (searchTerm === '' || Number(searchTerm) == 0) return postResult(interaction, invalidSearch(), true);
    const foundUser = await user.NexusMods.API.v2.FindUser(searchTerm);
    if (!foundUser) return postResult(interaction, noUserFound(), true);
    else return postResult(interaction, userResult(foundUser), ephemeral);
}

function createModResultField(item: IModFieldResult): EmbedField {
    return {
        name: `${item.id} - ${item.mod.name}`,
        value: `${item.game ? `Game: ${item.game.name} - ` : ''}Author: [${item.mod.uploader.name}](https://nexusmods.com/users/${item.mod.uploader.memberId}) - [View mod page](https://nexusmods.com/${item.mod.game.domainName}/mods/${item.mod.modId})`,
        inline: false
    }
}

const searchCancelled = (): EmbedBuilder => {
    const embed = new EmbedBuilder()
    .setColor('DarkRed')
    .setTitle('Search Cancelled')
    .setDescription('You are not authorised to use this command. This means that either you have not linked your account, or your session has expired.')
    .addFields({ name: 'How can I fix this?', value: '[Click here to re-authorise your account](https://discordbot.nexusmods.com/linked-role), then try again.' })

    return embed;
}

const singleModEmbed = (client: Client, mod: IMod|undefined, game?: IGameStatic): EmbedBuilder => {
    const embed = new EmbedBuilder()
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
    .setThumbnail(game? `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`: client.user?.avatarURL() || '')

    if (mod) {
        embed.setTitle(mod.name || 'Mod name unavailable')
        .setURL(nexusModsTrackingUrl(`https://nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`, 'search'))
        .setDescription(`${game ? `**Game:** [${game?.name}](https://nexusmods.com/${game.domain_name})\n**Category:** ${mod.modCategory.name}\n` : ''}**Version:** ${mod.version}\n\n${mod.summary?.replace(/\<br \/\>/g, '\n')}`)
        .setTimestamp(new Date(mod.updatedAt))
        .setImage(mod.pictureUrl || '')
        .setAuthor({name: mod.uploader?.name || '', url: `https://nexusmods.com/users/${mod.uploader.memberId}` })
    }
    else embed.setTitle('Error getting mod info');
    // else {
    //     embed.setTitle(res.name)
    //     .setURL(`https://nexusmods.com/${res.url}`)
    //     .setAuthor({name: res.username || '', url: `https://nexusmods.com/users/${res.user_id}`})
    //     .setImage(`https://staticdelivery.nexusmods.com${res.image}`)
    //     .setDescription(game ? `for [${game?.name}](https://nexusmods.com/${game.domainName})` : '')
    //     .addFields({ name: 'Get better results', value: 'Filter your search by game and get more mod info in your result by linking in your account. See `!nm link` for more.'})
    // }
    
    return embed;
}

const collectionEmbed = (client: Client, res: ICollection, nsfw: boolean): EmbedBuilder => {
    const successRatingIcon = (value: number, voteCount: number) => {
        if (voteCount < 3) return '⚪';
        else if (value >= 75) return '🟢';
        else if (value >= 50) return '🟡';
        else return '🔴';
    }

    const url = `https://next.nexusmods.com/${res.game?.domainName}/collections/${res.slug}`;

    if (!nsfw && res.latestPublishedRevision.adultContent) {
        const nsfwEmbed = new EmbedBuilder()
        .setColor('DarkRed')
        .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
        .setTitle('Adult content')
        .setDescription(`[${res.name}](${url}) contains adult content. This Discord channel is not age-restricted so you must view this content on the website.`)
        return nsfwEmbed;
    }

    const embed = new EmbedBuilder()
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
    .setThumbnail(res.tileImage.thumbnailUrl || client.user?.avatarURL() || null)
    .setURL(url)
    .setTitle(res.name || 'Unknown Collection')
    .setDescription(res.summary || 'No summary')
    .setTimestamp(new Date(parseInt(res.updatedAt as any) || 0))
    .setAuthor({ name: res.user?.name || '???', url: `https://nexusmods.com/users/${res.user?.memberId || 0}`, iconURL: res.user?.avatar })
    .addFields(
        {
            name: '🎮 Game',
            value: res.game?.name || '???',
            inline: true
        },
        {
            name: `<:mod:${customEmojis.mod}> Mods`,
            value: `${(res.latestPublishedRevision.modCount || 0).toLocaleString()}`,
            inline: true
        },
        {
            name: `<:collection:${customEmojis.collection}> Revisions`,
            value: `${res.latestPublishedRevision.revisionNumber || 1}`,
            inline: true
        },
        {
            name: '⬇️ Downloads',
            value: `${(res.totalDownloads || 0).toLocaleString()}`,
            inline: true
        },
        {
            name: '👍 Endorsements',
            value: `${(res.endorsements || 0).toLocaleString()}`,
            inline: true
        },
        {
            name: `${successRatingIcon(parseFloat(res.overallRating.toString() || '0'), res.overallRatingCount || 0)} Success Rating`,
            value: `${res.overallRatingCount! >= 3 ? `${res.overallRating}%` : '_TBC_'}`,
            inline: true
        },
        {
            name: `<:vortex:${customEmojis.vortex}> Add to Vortex`,
            value: `<nxm://skyrimspecialedition/collections/${res.slug}/revisions/latest>`,
            inline: false
        }
    );
    return embed;
}

const noGameResults = (client: Client, gameList: IGameStatic[], searchTerm: string): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle("Game Search Results")
    .setDescription(`I checked all ${gameList.length.toLocaleString()} games for "${searchTerm}" but couldn't find anything. Please check your spelling or try expanding any acronyms (SSE -> Skyrim Special Edition)`)
    .setThumbnail(client.user?.avatarURL() || '')
    .setColor(0xda8e35)
    .setFooter({ text: "Nexus Mods API link", iconURL: client.user?.avatarURL() || '' })
    .addFields({ name:`Looking to upload a mod for "${searchTerm}"?`, value: `If you've made a mod for ${searchTerm} we'd love it if you shared it on Nexus Mods!\n[You can find out more about adding a mod for a new game here.](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)`})
}

const oneGameResult = (client: Client, gameInfo: IGameStatic): EmbedBuilder => {
    const game = new EmbedBuilder()
    .setTitle(gameInfo.name)
    .setColor(0xda8e35)
    .setURL(`https://www.nexusmods.com/${gameInfo.domain_name || ''}`)
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${gameInfo.id}.jpg`)
    .addFields([
        {
            name: 'Genre',
            value: (gameInfo as any).genre || "Not yet available on API v2",
            inline: true
        },
        {
            name: 'Mods',
            value: (gameInfo as any).modCount ? Number((gameInfo as any).modCount).toLocaleString() : 'Not yet available on API v2',
            inline: true 
        },
        {
            name: 'Collections',
            value: Number(gameInfo.collections ?? 0).toLocaleString(),
            inline: true 
        },
        {
            name: 'Downloads',
            value: (gameInfo as any).downloadCount ? Number((gameInfo as any).downloadCount).toLocaleString() : 'Not yet available on API v2',
            inline: true 
        },
        {
            name: 'Endorsements',
            value: (gameInfo as any).endorsements ? Number((gameInfo as any).endorsements).toLocaleString() : 'Not yet available on API v2',
            inline: true 
        }
    ])
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
    if (!gameInfo.approved_date || gameInfo.approved_date <= 1) {
        game.addFields({ name: "Unapproved Game", value: `${gameInfo.name} is pending approval by Nexus Mods staff. Once a mod has been uploaded and reviewed the game will be approved.\n[How can I add a new game to Nexus Mods?](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)`})
        .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_empty.png`);
    }

    return game;
}

const multiGameResult = (client: Client, results: IGameStatic[], query: string): EmbedBuilder => {
    const displayable = results.slice(0, 5);
    
    return new EmbedBuilder()
    .setTitle("Game Search Results")
    .setDescription(`Showing ${results.length < 5 ? results.length : 5} results for "${query}". [See all${results.length > 5 ? " "+results.length : "" }...](https://www.nexusmods.com/games)`)
    .setThumbnail(client.user?.avatarURL() || '')
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
    .addFields(displayable.map((game: IGameStatic): EmbedField => {
        return {
            name: game.name,
            value: `**Genre:** ${(game as any).genre || 'Not yet available on API v2'} | **Mods:** ${Number((game as any).modCount || 0).toLocaleString()}\n**Downloads**: ${Number((game as any).downloadCount || 0).toLocaleString()} | **Endorsements**: ${Number((game as any).file_endorsements || 0).toLocaleString()}${`\n http://www.nexusmods.com/${game.domain_name || ''}`}`,
            inline: false
        }
    }));
}


async function postResult(interaction: ChatInputCommandInteraction, embed: EmbedBuilder, ephemeral: boolean) {
    const editReply: boolean = (interaction.deferred || interaction.replied)// ? interaction.editReply : interaction.reply;

    if (ephemeral) {
        if (editReply) return interaction.editReply({content: undefined, embeds: [embed]})
            .catch(e => {sendUnexpectedError(interaction, interaction, e)});
        else return interaction.reply({content: undefined, embeds: [embed], flags: MessageFlags.Ephemeral})
        .catch(e => {sendUnexpectedError(interaction, interaction, e)});
    }

    if (editReply) interaction.editReply({ content: 'Search result posted!', embeds:[], components: []})
        .catch(e => {sendUnexpectedError(interaction, interaction, e)});
    else interaction.reply({ content: 'Search result posted!', embeds:[], components: [], flags: MessageFlags.Ephemeral})
    .catch(e => {sendUnexpectedError(interaction, interaction, e)});

    // wait 100 ms - If the wait is too short, the original reply will end up appearing after the embed in single-result searches
    await new Promise(resolve => setTimeout(resolve, 100));

    return interaction.followUp({content: '', embeds: [embed], flags: ephemeral ? MessageFlags.Ephemeral : undefined})
        .catch(e => {sendUnexpectedError(interaction, interaction, e)});
}

export { discordInteraction };