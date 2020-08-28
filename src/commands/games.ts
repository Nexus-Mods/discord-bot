import { Client, Message, GuildChannel, DMChannel, TextChannel, MessageEmbed, EmbedFieldData } from "discord.js";
import { BotServer } from "../types/servers";
import { CommandHelp } from "../types/util";
import { NexusUser } from "../types/users";
import { getUserByDiscordId } from "../api/bot-db";
import { games } from "../api/nexus-discord";
import Fuse from 'fuse.js';
import { IGameInfo } from "@nexusmods/nexus-api";

const help: CommandHelp = {
    name: "games",
    description: "Searches for a matching game on Nexus Mods.",
    usage: "[query]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

async function run(client: Client, message: Message, args: string[], server: BotServer) {
    // Get reply channel
    const replyChannel: (GuildChannel | DMChannel | undefined | null) = server && server.channel_bot ? message.guild?.channels.resolve(server.channel_bot) : message.channel;
    const rc: TextChannel = replyChannel as TextChannel;
    const discordId: string = message.author.id;

    const userData: NexusUser | undefined = await getUserByDiscordId(discordId).catch(() => undefined);
    if (!userData) return rc.send(`${message.channel === rc ? '' : message.author.toString()+', '}Please link your account to the before using this feature. See \`!nm link\` for more information.`).catch(() => undefined);

    const msg: Message|void = await rc.send('Searching for games...').catch(() => { return });

    try {
        const allGames: IGameInfo[] = await games(userData, true);
        const query = args.join(' ');
        if (!query) throw new Error('Please provide a search term, see `!nm help games` for more info');

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

        const fuse = new Fuse(allGames, options);

        const results: IGameInfo[] = fuse.search(query).map(r => r.item);

        // No results
        if (!results.length) return (msg as Message).edit(message.channel !== rc ? message.author: '', noResults(client, allGames, query)).catch(() => undefined);
        // One result
        else if (results.length === 1) return (msg as Message).edit(message.channel !== rc ? message.author: '', oneResult(client, message, results[0])).catch(() => undefined);
        // Several results
        else return (msg as Message).edit(message.channel !== rc ? message.author: '', multiResult(client, message, results, query)).catch(() => undefined);
    }
    catch(err) {
        console.error(err);
        return (msg as Message).edit(`${message.channel === rc ? '' : message.author.toString()+', '}There was an error completing the game search: ${err.message}.`).catch(() => undefined);
    }
}

const noResults = (client: Client, gameList: IGameInfo[], searchTerm: string): MessageEmbed => {
    return new MessageEmbed()
    .setTitle("Game Search Results")
    .setDescription(`I checked all ${gameList.length.toLocaleString()} games for "${searchTerm}" but couldn't find anything. Please check your spelling or try expanding any acronyms (SSE -> Skyrim Special Edition)`)
    .setThumbnail(client.user?.avatarURL() || '')
    .setColor(0xda8e35)
    .setFooter("Nexus Mods API link",client.user?.avatarURL() || '')
    .addField(`Looking to upload a mod for "${searchTerm}"?`, `If you've made a mod for ${searchTerm} we'd love it if you shared it on Nexus Mods!\n[You can find out more about adding a mod for a new game here.](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)`)
}

const oneResult = (client: Client, message: Message, gameInfo: IGameInfo): MessageEmbed => {
    const game = new MessageEmbed()
    .setTitle(gameInfo.name)
    .setColor(0xda8e35)
    .setURL((gameInfo.nexusmods_url ? gameInfo.nexusmods_url : "https://www.nexusmods.com") )
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${gameInfo.id}.jpg`)
    .addField("Genre",(gameInfo.genre? gameInfo.genre : "Not specified" ),true)
    .addField("Mods",Number(gameInfo.mods).toLocaleString(),true)
    .addField("Downloads",Number(gameInfo.downloads).toLocaleString(),true)
    .addField("Endorsements",Number((gameInfo as any).file_endorsements || 0).toLocaleString(),true)
    .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user?.avatarURL() || '')
    if (!gameInfo.approved_date || gameInfo.approved_date < 1) {
        game.addField("Unapproved Game",`${gameInfo.name} is pending approval by Nexus Mods staff. Once a mod has been uploaded and reviewed the game will be approved.\n[How can I add a new game to Nexus Mods?](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)`)
        .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_empty.png`);
    }

    return game;
}

const multiResult = (client: Client, message: Message, results: IGameInfo[], query: string): MessageEmbed => {
    const displayable = results.slice(0, 5);
    
    return new MessageEmbed()
    .setTitle("Game Search Results")
    .setDescription(`Showing ${results.length < 5 ? results.length : 5} results for "${query}". [See all${results.length > 5 ? " "+results.length : "" }...](https://www.nexusmods.com/games)`)
    .setThumbnail(client.user?.avatarURL() || '')
    .setColor(0xda8e35)
    .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user?.avatarURL() || '')
    .addFields(displayable.map((game: IGameInfo): EmbedFieldData => {
        return {
            name: game.name,
            value: `**Genre:** ${game.genre ? game.genre : "Not specified"} | **Mods:** ${Number(game.mods).toLocaleString()}\n**Downloads**: ${Number(game.downloads).toLocaleString()} | **Endorsements**: ${Number((game as any).file_endorsements || 0).toLocaleString()}${game.nexusmods_url !== "http://www.nexusmods.com/" ? "\n"+game.nexusmods_url : "\n*Pending approval. [What does this mean?](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)*"}`
        }
    }));
}

export { run, help }