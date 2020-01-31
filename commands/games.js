const Discord = require('discord.js');
const nexusAPI = require('../api/nexus-discord.js');
const Fuse = require('fuse.js'); //https://fusejs.io/
const { getUserByDiscordId } = require('../api/bot-db.js');


module.exports.help = {
    name: "games",
    description: "Searches for a matching game on Nexus Mods.",
    usage: "[query]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

exports.run = async (client, message, args, serverData) => {
    const replyChannel = serverData && serverData.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel

    const userData = getUserByDiscordId(message.author.id);
    if(!userData) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""}Please link your account to the before using this feature. See \`!nm link\` for more information.`)

    try {
        const gamelist = await nexusAPI.games(userData, 1)
            
        var searchTerm = args.join(" ")

        var options = {
            shouldSort: true,
            tokenize: true,
            matchAllTokens: true,
            findAllMatches: true,
            threshold: 0.4,
            location: 0,
            distance: 25,
            maxPatternLength: 16,
            minMatchCharLength: 3,
            keys: [
            {name: "name", weight: 0.6},
            {name: "id", weight: 0.1},
            {name: "domain_name", weight: 0.3}
             ]
        };

        var fuse = new Fuse(gamelist, options);
        var results = fuse.search(searchTerm);
        //No results
        if (results.length === 0) {
            var searchNoGamesEmbed = new Discord.RichEmbed()
            .setTitle("Game Search Results")
            .setDescription(`I checked all ${gamelist.length} games for "${searchTerm}" but couldn't find anything. Please check your spelling or try expanding any acronyms (SSE -> Skyrim Special Edition)`)
            .setThumbnail(client.user.avatarURL)
            .setColor(0xda8e35)
            .setFooter("Nexus Mods API link",client.user.avatarURL)
            .addField(`Looking to upload a mod for "${searchTerm}"?`, `If you've made a mod for ${searchTerm} we'd love it if you shared it on Nexus Mods!\n[You can find out more about adding a mod for a new game here.](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)`)

            return replyChannel.send((replyChannel !== message.channel ? message.author+" " : ""),searchNoGamesEmbed).catch(console.error);

        }
        //only 1 result
        else if (results.length === 1) {
            var gameInfo = results[0]
            const gameMessage = new Discord.RichEmbed()
            .setTitle(gameInfo.name)
            .setColor(0xda8e35)
            .setURL((gameInfo.nexusmods_url ? gameInfo.nexusmods_url : "https://www.nexusmods.com") )
            .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${gameInfo.id}.jpg`)
            //.setThumbnail(client.user.avatarURL)
            .addField("Genre",(gameInfo.genre? gameInfo.genre : "Not specified" ),true)
            .addField("Mods",Number(gameInfo.mods).toLocaleString(),true)
            .addField("Downloads",Number(gameInfo.downloads).toLocaleString(),true)
            .addField("Endorsements",Number(gameInfo.file_endorsements).toLocaleString(),true)
            .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)

            if (!gameInfo.approved_date || gameInfo.approved_date < 1) {
                gameMessage.addField("Unapproved Game",`${gameInfo.name} is pending approval by Nexus Mods staff. Once a mod has been uploaded and reviewed the game will be approved.\n[How can I add a new game to Nexus Mods?](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)`)
                .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_empty.png`);
            }
                
            return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""}Game Search for ${searchTerm}`,gameMessage)

        }
        //several results
        else {
            const gameMessage = new Discord.RichEmbed()
            .setTitle("Game Search Results")
            .setDescription(`Showing ${results.length < 5 ? results.length : 5} results for "${searchTerm}". [See all${results.length > 5 ? " "+results.length : "" }...](https://www.nexusmods.com/games)`)
            .setThumbnail(client.user.avatarURL)
            .setColor(0xda8e35)
            .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)
            for (i = 0; i < (results.length < 5 ? results.length : 5); i++) {
                var game = results[i]
                gameMessage.addField(game.name, `**Genre:** ${game.genre ? game.genre : "Not specified"} | **Mods:** ${Number(game.mods).toLocaleString()}\n**Downloads**: ${Number(game.downloads).toLocaleString()} | **Endorsements**: ${Number(game.file_endorsements).toLocaleString()}${game.nexusmods_url !== "http://www.nexusmods.com/" ? "\n"+game.nexusmods_url : "\n*Pending approval. [What does this mean?](https://help.nexusmods.com/article/104-how-can-i-add-a-new-game-to-nexus-mods)*"}`)

            }
            return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""}Game Search for ${searchTerm}`,gameMessage)
        }
        
    }
    catch (err) {
        return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""}Unable to complete game search. ${err}`)
    }

    
};
