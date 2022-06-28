import { CommandInteraction, MessageActionRow, Client, MessageEmbed, Message, MessageButton, TextChannel, EmbedFieldData, ButtonInteraction, Interaction } from "discord.js";
import { DiscordInteraction, NexusSearchResult, NexusSearchModResult } from "../types/util";
import { getUserByDiscordId, getServer } from '../api/bot-db';
import Fuse from 'fuse.js';
import { logMessage } from "../api/util";
import { NexusUser } from "../types/users";
import { IGameInfo, IModInfo } from "@nexusmods/nexus-api";
import { games, quicksearch, modInfo } from "../api/nexus-discord";
import { BotServer } from "../types/servers";

const numberEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

const options: Fuse.IFuseOptions<any> = {
    shouldSort: true,
    findAllMatches: true,
    threshold: 0.4,
    location: 0,
    distance: 7,
    minMatchCharLength: 6,
    keys: [
        {name: "name", weight: 0.6},
        {name: "id", weight: 0.1},
        {name: "domain_name", weight: 0.3}
    ]
}

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'search',
        description: 'Quickly search for games or mods.',
        options: [
            {
                type: 'SUB_COMMAND',
                name: 'mods',
                description: 'Search for mods on Nexus Mods',
                options: [
                    {
                        name: 'mod-title',
                        type: 'STRING',
                        description: 'Search by mod title',
                        required: true,
                    },
                    {
                        name: 'game-title',
                        type: 'STRING',
                        description: 'Select a game by title or domain name. e.g. Fallout New Vegas or newvegas',
                        required: false
                    },
                    // {
                    //     name: 'private',
                    //     type: 'BOOLEAN',
                    //     description: 'Only show the results to me.',
                    //     required: false
                    // }
                ]
            },
            {
                type: 'SUB_COMMAND',
                name: 'games',
                description: 'Search for games on Nexus Mods',
                options: [
                    {
                        name: 'game-title',
                        type: 'STRING',
                        description: 'Select a game by title or domain name. e.g. Fallout New Vegas or newvegas',
                        required: true
                    },
                    // {
                    //     name: 'private',
                    //     type: 'BOOLEAN',
                    //     description: 'Only show the results to me.',
                    //     required: false
                    // }
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

interface IModFieldResult {
    id: string;
    mod: NexusSearchModResult;
    game: IGameInfo|undefined;
}

async function action(client: Client, baseinteraction: Interaction): Promise<any> {
    const interaction = (baseinteraction as CommandInteraction);
    // logMessage('Search interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: interaction.channel?.toString() });

    const searchType: string = interaction.options.getSubcommand(true).toUpperCase();
    
    const modQuery: string = interaction.options.getString('mod-title') || '';
    const gameQuery : string = interaction.options.getString('game-title') || '';
    const ephemeral: boolean = interaction.options.getBoolean('private') || false

    if (!searchType) return interaction.reply('Invalid search parameters');

    await interaction.deferReply({ ephemeral }).catch(err => { throw err });;

    const user: NexusUser = await getUserByDiscordId(interaction.user.id);
    const server: BotServer | null = interaction.guild ? await getServer(interaction?.guild) : null;

    switch(searchType) {
        case 'MODS' : return searchMods(modQuery, gameQuery, client, interaction, user, server);
        case 'GAMES' : return searchGames(gameQuery, client, interaction, user, server);
        default: return interaction.editReply('Search error: Neither mods or games were selected.');
    }
}

async function searchMods(query: string, gameQuery: string, client: Client, interaction: CommandInteraction, user: NexusUser, server: BotServer|null) {
    logMessage('Mod search', {query, gameQuery, user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name});

    const allGames: IGameInfo[] = user ? await games(user, false).catch(() => []) : [];
    let gameIdFilter: number = server?.game_filter || 0;

    if (gameQuery !== '' && allGames.length) {
        // logMessage('Searching for game in mod search', gameQuery);
        // Override the default server game filter. 
        const fuse = new Fuse(allGames, options);

        const results: IGameInfo[] = fuse.search(gameQuery).map(r => r.item);
        if (results.length) {
            // logMessage('Found game in mod search', results[0].name);
            const closestMatch = results[0];
            gameIdFilter = closestMatch.id;
        }
    }


    const filterGame: IGameInfo|undefined = allGames.find(g => g.id === gameIdFilter);

    // Search for mods
    try {
        const search: NexusSearchResult = await quicksearch(query, (interaction.channel as TextChannel)?.nsfw, gameIdFilter);
        if (!search.results.length) {
            // No results!
            const noResults: MessageEmbed = new MessageEmbed()
            .setTitle('Search complete')
            .setDescription(`No results for "${query}".\nTry using the [full search](${search.fullSearchURL}) on the website.`)
            .setThumbnail(client.user?.avatarURL() || '')
            .setColor(0xda8e35);

            return interaction.editReply({ content: null, embeds:[noResults] });
        }
        else if (search.results.length === 1) {
            // Single result
            const res: NexusSearchModResult = search.results[0];
            const mod: IModInfo|undefined  = user ? await modInfo(user, res.game_name, res.mod_id) : undefined;
            const gameForMod: IGameInfo|undefined = filterGame || allGames.find(g => g.domain_name === res.game_name);
            const singleResult = singleModEmbed(client, res, mod, gameForMod);
            return interaction.editReply({ content: null, embeds:[singleResult] });
        }
        else {
            // Multiple results
            const top5 = search.results.slice(0,5);
            const fields: IModFieldResult[] = top5.map(
                (res, idx) => ({ id: numberEmoji[idx], mod: res, game: allGames.find(g => g.domain_name === res.game_name) })
            );
            // Create the button row.
            const buttons = new MessageActionRow()
            .addComponents(
                top5.map((r, idx) => {
                    return  new MessageButton()
                    .setCustomId(r.mod_id.toString())
                    .setLabel(numberEmoji[idx])
                    .setStyle('PRIMARY')
                })
            );
            const multiResult = new MessageEmbed()
            .setTitle('Search complete')
            .setColor(0xda8e35)
            .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${gameIdFilter}.jpg`)
            .setDescription(
                `Showing ${search.total < 5 ? search.total : 5} of ${search.total} results ([See all](${search.fullSearchURL}))\n`+
                `Query: "${query}" - Time: ${search.took}ms - Adult content: ${search.include_adult}\n`+
                `${!!filterGame ? `Game: ${filterGame.name}` : null}`
            )
            .addFields(fields.map(createModResultField))
            if (!user) multiResult.addField('Get better results', 'Filter your search by game and get more mod info in your result by linking in your account. See `!nm link` for more.');

            // Post the result
            const reply: Message = await interaction.editReply({ embeds: [multiResult], components: [buttons] }) as Message;
            // Record button presses
            const collector = reply.createMessageComponentCollector({ componentType: 'BUTTON', time: 60000 });

            collector.on('collect', async (i: ButtonInteraction) => {
                collector.stop('Collected');
                const reply = await i.update({ components: [], fetchReply: true });
                const id = i.customId;
                const found: IModFieldResult|undefined = fields.find(f => f.mod.mod_id.toString() === id);
                const res = found?.mod;
                if (!res) {
                    (reply as Message).edit({ content: 'Search failed!', embeds:[], components: [] });
                    return;
                }
                const mod = await modInfo(user, res.game_name, res.mod_id).catch(() => undefined);
                (reply as Message).edit({ embeds:[singleModEmbed(client, res, mod, found?.game)] });              
            });

            collector.on('end', ic => {
                if (!ic.size) ic.first()?.update({ components: [] });
            });


        }
    }
    catch(err) {
        logMessage('Mod Search failed!', {query, user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name}, true);
    }

}

async function searchGames(query: string, client: Client, interaction: CommandInteraction, user: NexusUser, server: BotServer|null) {
    logMessage('Game search', {query, user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name});
    if (!user) return interaction.editReply('Please link your account to use this feature. See /link.');

    const allGames = await games(user, true).catch(() => []);
    const fuse = new Fuse(allGames, options);

    const results: IGameInfo[] = fuse.search(query).map(r => r.item);

    if (!results.length) return interaction.editReply({ embeds: [noGameResults(client, allGames, query)] });
    else if (results.length === 1) return interaction.editReply({ embeds: [oneGameResult(client, results[0])] });
    else return interaction.editReply({ embeds: [multiGameResult(client, results, query)] });
    
}

function createModResultField(item: IModFieldResult): EmbedFieldData {
    return {
        name: `${item.id} - ${item.mod.name}`,
        value: `${item.game ? `Game: ${item.game.name} - ` : ''}Author: [${item.mod.username}](https://nexusmods.com/users/${item.mod.user_id}) - [View mod page](https://nexusmods.com/${item.mod.url})`
    }
}

const singleModEmbed = (client: Client, res: NexusSearchModResult, mod: IModInfo|undefined, game?: IGameInfo): MessageEmbed => {
    const embed = new MessageEmbed()
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
    .setThumbnail(game? `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`: client.user?.avatarURL() || '')
    
    if (mod) {
        embed.setTitle(mod.name || 'Mod name unavailable')
        .setURL(`https://nexusmods.com/${mod.domain_name}/mods/${mod.mod_id}`)
        .setDescription(`${game ? `**Game:** [${game?.name}](https://nexusmods.com/${game.domain_name})\n**Category:** ${game.categories.find(c => c.category_id === mod.category_id)?.name}\n` : ''}**Version:** ${mod.version}\n\n${mod.summary?.replace(/\<br \/\>/g, '\n')}`)
        .setTimestamp(new Date(mod.updated_time))
        .setImage(mod.picture_url || '')
        .setAuthor({name: mod.user?.name || '', url: `https://nexusmods.com/users/${mod.user.member_id}` })
    }
    else {
        embed.setTitle(res.name)
        .setURL(`https://nexusmods.com/${res.url}`)
        .setAuthor({name: res.username || '', url: `https://nexusmods.com/users/${res.user_id}`})
        .setImage(`https://staticdelivery.nexusmods.com${res.image}`)
        .setDescription(game ? `for [${game?.name}](https://nexusmods.com/${game.domain_name})` : '')
        .addField('Get better results', 'Filter your search by game and get more mod info in your result by linking in your account. See `!nm link` for more.')
    }
    
    return embed;
}

const noGameResults = (client: Client, gameList: IGameInfo[], searchTerm: string): MessageEmbed => {
    return new MessageEmbed()
    .setTitle("Game Search Results")
    .setDescription(`I checked all ${gameList.length.toLocaleString()} games for "${searchTerm}" but couldn't find anything. Please check your spelling or try expanding any acronyms (SSE -> Skyrim Special Edition)`)
    .setThumbnail(client.user?.avatarURL() || '')
    .setColor(0xda8e35)
    .setFooter({ text: "Nexus Mods API link", iconURL: client.user?.avatarURL() || '' })
    .addField(`Looking to upload a mod for "${searchTerm}"?`, `If you've made a mod for ${searchTerm} we'd love it if you shared it on Nexus Mods!\n[You can find out more about adding a mod for a new game here.](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)`)
}

const oneGameResult = (client: Client, gameInfo: IGameInfo): MessageEmbed => {
    const game = new MessageEmbed()
    .setTitle(gameInfo.name)
    .setColor(0xda8e35)
    .setURL((gameInfo.nexusmods_url ? gameInfo.nexusmods_url : "https://www.nexusmods.com") )
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${gameInfo.id}.jpg`)
    .addField("Genre",(gameInfo.genre? gameInfo.genre : "Not specified" ),true)
    .addField("Mods",Number(gameInfo.mods).toLocaleString(),true)
    .addField("Downloads",Number(gameInfo.downloads).toLocaleString(),true)
    .addField("Endorsements",Number((gameInfo as any).file_endorsements || 0).toLocaleString(),true)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
    if (!gameInfo.approved_date || gameInfo.approved_date < 1) {
        game.addField("Unapproved Game",`${gameInfo.name} is pending approval by Nexus Mods staff. Once a mod has been uploaded and reviewed the game will be approved.\n[How can I add a new game to Nexus Mods?](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)`)
        .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_empty.png`);
    }

    return game;
}

const multiGameResult = (client: Client, results: IGameInfo[], query: string): MessageEmbed => {
    const displayable = results.slice(0, 5);
    
    return new MessageEmbed()
    .setTitle("Game Search Results")
    .setDescription(`Showing ${results.length < 5 ? results.length : 5} results for "${query}". [See all${results.length > 5 ? " "+results.length : "" }...](https://www.nexusmods.com/games)`)
    .setThumbnail(client.user?.avatarURL() || '')
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
    .addFields(displayable.map((game: IGameInfo): EmbedFieldData => {
        return {
            name: game.name,
            value: `**Genre:** ${game.genre ? game.genre : "Not specified"} | **Mods:** ${Number(game.mods).toLocaleString()}\n**Downloads**: ${Number(game.downloads).toLocaleString()} | **Endorsements**: ${Number((game as any).file_endorsements || 0).toLocaleString()}${game.nexusmods_url !== "http://www.nexusmods.com/" ? "\n"+game.nexusmods_url : "\n*Pending approval. [What does this mean?](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)*"}`
        }
    }));
}


export { discordInteraction };