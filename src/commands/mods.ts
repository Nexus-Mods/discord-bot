import { Client, Message, GuildChannel, PartialDMChannel, DMChannel, TextChannel, MessageEmbed, EmbedFieldData, Emoji, MessageReaction, User, ThreadChannel, ReactionCollector } from "discord.js";
import { BotServer } from "../types/servers";
import { CommandHelp, NexusSearchResult, NexusSearchModResult } from "../types/util";
import { NexusUser } from "../types/users";
import { getUserByDiscordId } from "../api/users";
import { IGameInfo, IModInfo } from "@nexusmods/nexus-api";
import { games, quicksearch, modInfo } from "../api/nexus-discord";
const numberEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

const help: CommandHelp = {
    name: "mods",
    description: "Search for a mod on Nexus Mods.\n_[gamedomain] - Optional. Will search only this game, rather than the entire site._",
    usage: "[query] -for: [game]",
    moderatorOnly: false,
    adminOnly: false 
}

async function run(client: Client, message: Message, args: string[], server: BotServer) {
    // Get reply channel
    const replyChannel: (GuildChannel| PartialDMChannel | DMChannel | ThreadChannel | undefined | null) = server && server.channel_bot ? message.guild?.channels.resolve(server.channel_bot) : message.channel;
    const rc: TextChannel = (replyChannel as TextChannel);
    const prefix = rc === message.channel ? '' : `${message.author.toString()}`
    const discordId: string = message.author.id;

    // Get User data
    const userData: NexusUser | undefined = await getUserByDiscordId(discordId).catch(() => undefined);
    // if (!userData) return rc.send(`${prefix}You do not have a Nexus Mods account linked to your Discord profile.`).catch(() => undefined);


    // Get the query
    let query: string = args.join(' ');
    let embed: MessageEmbed = startUpEmbed(client, message, query)
    const reply: Message = await rc.send({content: prefix, embeds: [embed] });

    // Get game info.
    let allGames: IGameInfo[] = userData ? await games(userData, false): [];
    let filterId: number|string = server.game_filter || 0;
    let filterGame: IGameInfo|undefined = allGames.find(g => g.id === ( typeof(filterId) == 'string' ? parseInt(filterId) : filterId));

    if (args.find(a => a.startsWith('-for:'))) {
        const splitQuery: string[] = query.split('-for:');
        query = splitQuery[0];        
        const gameQuery: string = splitQuery.slice(-1)[0].trim().toLowerCase();
        const gamefilter: IGameInfo|undefined = allGames.find(g => g.name.toLowerCase() === gameQuery || g.domain_name.toLowerCase() === gameQuery);
        if (gamefilter) {
            filterId = gamefilter.id;
            filterGame = gamefilter;
        }
    }
    
    // Update the embed if we know which game we're filtering.
    if (filterGame && !embed.fields.length) {
        embed.setTitle(`Searching for ${filterGame.name} mods...`)
        .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${filterId}.jpg`)
        .setDescription(`Search query: ${query}`);
        await reply.edit({ embeds: [embed] }).catch(() => undefined);
    }

    // Perform the search
    try {
        const search: NexusSearchResult = await quicksearch(query, rc.nsfw, filterId);
        if (!search.results.length) {
            // No results
            embed.setTitle('Search complete')
            .setDescription(`No results for "${query}".\nTry using the [full search](${search.fullSearchURL}) on the website.`);
            return reply.edit({ embeds: [embed] }).catch(() => undefined);
        }
        else if (search.results.length === 1) {
            // Single result
            const res: NexusSearchModResult = search.results[0];
            const mod: IModInfo|undefined = userData ? await modInfo(userData, res.game_name, res.mod_id).catch(() => undefined) : undefined;
            embed = singleModEmbed(client, message, res, mod, allGames.find(g => g.domain_name === res.game_name));
            return reply.edit({ embeds: [embed] }).catch(() => undefined);
        }
        else {
            // Multiple results (Only show the top 5)
            const top5 = search.results.slice(0, 5).map((res, idx) => { return { id: numberEmoji[idx], mod: res, game: allGames.find(g => g.domain_name === res.game_name) } });
            embed.setTitle('Search complete')
            .setDescription(
                `Showing ${search.total < 5 ? search.total : 5} of ${search.total} results ([See all](${search.fullSearchURL}))\n`+
                `Query: "${query}" - Time: ${search.took}ms - Adult content: ${search.include_adult}`
            )
            .addFields(top5.map(createResultField));
            if (!userData) embed.addField('Get better results', 'Filter your search by game and get more mod info in your result by linking in your account. See `!nm link` for more.')
            reply.edit({ embeds: [embed] }).catch(() => undefined);
            await Promise.all(top5.map(async e => await reply.react(e.id)));
            const filter = (r: MessageReaction, user: User): boolean => user === message.author && (!!r.emoji.name && numberEmoji.includes(r.emoji.name));
            const collector: ReactionCollector = reply.createReactionCollector({ filter, time: 45000, max: 1 });

            collector.on('collect', async r => {
                collector.stop('Collected required emoji');
                const found = top5.find(res => res.id === r.emoji.name);
                const res: NexusSearchModResult|undefined = found?.mod;
                if(!res) {
                    embed.setColor('#ff0000')
                    .setTitle(`Search failed`)
                    .setDescription(`There was an error with your search. Please try again later.\n${`There doesn't seem to be a mod associated with ${r.emoji.name}`}`);
                    return reply.edit({ embeds: [embed] }).catch(() => undefined);
                }
                
                const mod: IModInfo|undefined = userData? await modInfo(userData, res.game_name, res.mod_id).catch(() => undefined) : undefined;
                embed = singleModEmbed(client, message, res, mod, found?.game);
                return reply.edit({ embeds: [embed] }).catch(() => undefined);
            });
            collector.on('end', rc => reply.reactions.removeAll().catch(() => undefined));
            
        };
    }
    catch(err: any) {
        embed.setColor('#ff0000')
        .setTitle(`Search failed`)
        .setDescription(`There was an error with your search. Please try again later.\n${err.message}`)
        return reply.edit({ embeds: [embed] }).catch(() => undefined);
    }

}

function createResultField(item: { id: string, mod: NexusSearchModResult, game: IGameInfo|undefined }): EmbedFieldData {
    return {
        name: `${item.id} - ${item.mod.name}`,
        value: `${item.game ? `Game: ${item.game.name} - ` : ''}Author: [${item.mod.username}](https://nexusmods.com/users/${item.mod.user_id}) - [View mod page](https://nexusmods.com/${item.mod.url})`
    }
}

const startUpEmbed = (client: Client, message: Message, query: string): MessageEmbed => {
    return new MessageEmbed()
    .setTitle(`Searching mods...`)
    .setThumbnail(client.user?.avatarURL() || '')
    .setDescription(`Search query: ${query}`)
    .setColor(0xda8e35)
    .setFooter({ text: `Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL: client.user?.avatarURL() || '' })
}

const singleModEmbed = (client: Client, message: Message, res: NexusSearchModResult, mod: IModInfo|undefined, game?: IGameInfo): MessageEmbed => {
    const embed = new MessageEmbed()
    .setColor(0xda8e35)
    .setFooter({ text: `Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL: client.user?.avatarURL() || '' })
    .setThumbnail(game? `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`: client.user?.avatarURL() || '')
    
    if (mod) {
        embed.setTitle(mod.name || 'Mod name unavailable')
        .setURL(`https://nexusmods.com/${mod.domain_name}/mods/${mod.mod_id}`)
        .setDescription(`${game ? `**Game:** [${game?.name}](https://nexusmods.com/${game.domain_name})\n**Category:** ${game.categories.find(c => c.category_id === mod.category_id)?.name}\n` : ''}**Version:** ${mod.version}\n\n${mod.summary?.replace(/\<br \/\>/g, '\n')}`)
        .setTimestamp(new Date(mod.updated_time))
        .setImage(mod.picture_url || '')
        .setAuthor({name: mod.user?.name || '', iconURL: `https://nexusmods.com/users/${mod.user.member_id}` })
    }
    else {
        embed.setTitle(res.name)
        .setURL(`https://nexusmods.com/${res.url}`)
        .setAuthor({name: res.username || '', iconURL: `https://nexusmods.com/users/${res.user_id}`})
        .setImage(`https://staticdelivery.nexusmods.com${res.image}`)
        .setDescription(game ? `for [${game?.name}](https://nexusmods.com/${game.domain_name})` : '')
        .addField('Get better results', 'Filter your search by game and get more mod info in your result by linking in your account. See `!nm link` for more.')
    }
    
    return embed;
}


export { run, help }