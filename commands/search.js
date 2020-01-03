const Discord = require('discord.js')
const { getUserByDiscordId } = require('../api/bot-db.js');
const nexusAPI = require('./../nexus-discord.js');
const serverConfig = require('./../serverconfig.json') //For server specific settings.

module.exports.help = {
    name: "search",
    description: "Search for a mod on Nexus Mods.\n_[gamedomain] - Optional. Will search only this game, rather than the entire site._",
    usage: "[gamedomain] [query]",
    moderatorOnly: false,
    adminOnly: false  
}


exports.run = async (client, message, args, serverSettings) => {
    if (!message.guild) return //this doesn't work in DMs
    
    //Grab settings for current server
    const searchResultsChannel = serverSettings && serverSettings.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel


    if (!serverSettings || serverSettings.webhookID === "" || serverSettings.webookToken === "") return message.channel.send("Mod search is not set up in this server.")

    var searchWebHook = new Discord.WebhookClient(serverSettings.webhookID,serverSettings.webhookToken)
    var searchResultsChannel = serverSettings.webhookID ? await message.guild.fetchWebhooks().then((wl) => message.guild.channels.find(c => c.id === wl.find(w => w.id === serverSettings.webhookID).channelID)) : none
    var gameID = serverSettings.searchGameFilter ? serverSettings.searchGameFilter.id : null
    var gameName = serverSettings.searchGameFilter && args[0] !== "-all" ? serverSettings.searchGameFilter.title : null

    //If the webHook was deleted externally or results channel could not be found..
    if (!searchWebHook || !searchResultsChannel) {
        serverSettings.webhookID = "";
        // TODO - Save this change
        return message.channel.send("There was a problem with the WebHook required by the search, please contact a server admin to check the bot configuration.")
    } 

    //Let the user know the search has started.
    searchMessage = await searchResultsChannel.send(`${message.channel !== searchResultsChannel ? message.author : message.author.tag}, your search results are being prepared and will appear here soon.`).then((msg) => {return msg}).catch(console.error);

    //Prepare to collect response text.
    var replyMessageText = []

    if (args[0] !== "-all" && gameID) replyMessageText.push(`_Hint: To search for mods from games other than ${gameName} start your search with "-all"._`)

    //Check if we need to apply a filter.
    var gameFilter = (gameID && args[0] !== "-all") ? gameID : undefined
    var nexusMember = getUserByDiscordId(message.author.id);
    if (!nexusMember) replyMessageText.push("_Hint: Link your Nexus Mods account to narrow your search by game. See `!nexus help link` for more._");

    if (nexusMember && !gameFilter && (args[0] === "-all"? args.length > 2 : args.length > 1)) {
        try {
            var gameResult = await nexusAPI.gameInfo(nexusMember, (args[0] === "-all" ? args[1] : args[0]))
            gameName = gameResult.name
            gameID = gameResult.id
            gameFilter = gameID
            if (args[0] === "-all") args = args.splice(1,args.length) //splice off the -all arg
            args = args.splice(1,args.length) //splice off the game prefix.

        }
        catch (err) {
            if (JSON.stringify(err).indexOf("404") === -1 && JSON.stringify(err).indexOf("403") === -1) console.log(err)
        }
    }

    if (args[0] === "-all") args = args.splice(1,args.length) //possibly redundant. 
    var query = args.join(" ")

    //Run the actual search and process results.
    try {
        var searchResults = await nexusAPI.quicksearch(query, 0, gameFilter)
    }
    catch (err) {
        return searchMessage.edit("There was an error with the search, please try again later.").catch(console.error)
    }

    var results = searchResults.results //get results
    var advSearch = searchResults.fullSearchURL //get advanced search URL
    var iTotalResults = searchResults.total
    replyMessageText.unshift(iTotalResults ? `${message.channel !== searchResultsChannel ? message.author : message.author.tag}\nSearch Results (${(iTotalResults >= 3 ? 3 : iTotalResults)} of ${iTotalResults}) for "${query}"`+(gameName ? ` in ${gameName}` : "")+`. Adult content will not be shown.` : `${message.channel !== searchResultsChannel ? message.author : message.author.tag}\nNo results found for "${query}"${gameFilter ? ` in ${gameName}`: ""}.`)
    if (iTotalResults === 0) return searchMessage.edit(replyMessageText.join("\n"))
    var resultEmbeds = [] //prepare an array for the results. 
    for(i=0; (i < 3 && i < results.length); i++) {
        var result = results[i]
        var resultEmbed = new Discord.RichEmbed()
        .setColor(0xda8e35)
        .setTitle(result.name)
        .setURL(`https://nexusmods.com${result.url}`)
        .setThumbnail(`https://staticdelivery.nexusmods.com${result.image}`)
        .setDescription(`Mod for ${(gameName ? gameName: result.game_name)} by [${result.username}](https://nexusmods.com/users/${result.user_id})`)
        .addField("Downloads", Number(result.downloads).toLocaleString(), true)
        .addField("Endorsements", Number(result.endorsements).toLocaleString(), true)
        
        resultEmbeds.push(resultEmbed)

    }
    var lastEmbed = new Discord.RichEmbed()
    .setTitle(`See all ${iTotalResults} results at NexusMods.com`)
    .setURL(advSearch)
    .setColor(0xda8e35)
    .setFooter(`Nexus Mods Quicksearch - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)
    resultEmbeds.push(lastEmbed)

    searchMessage.delete()

    //Send the data
    searchWebHook.send(replyMessageText,{embeds: resultEmbeds}).catch(console.error)
}

