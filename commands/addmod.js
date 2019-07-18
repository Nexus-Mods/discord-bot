const Discord = require('discord.js');
const link = require('./link.js');
const nexusAPI = require('./../nexus-discord.js');
const serverConfig = require('./../serverconfig.json') //For server specific settings.

module.exports.help = {
    name: "addmod",
    description: "Allows authors to show mods on their profile cards in Discord.\nCan also be used to gain 'Mod Author' status on servers.",
    usage: "[full mod title]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}


exports.run = async (client, message, args) => {
    const serverSettings = message.guild ? serverConfig.find(s => s.id === message.guild.id) : undefined;
    var replyChannel = serverSettings && serverSettings.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel 
    
    //No arguements passed. Explain the feature.
    if (args.length === 0) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""}To link a mod to your Discord account, type \`!nexus addmod <full mod title>\``).catch(console.error)
    
    const linkedAccounts = link.linkedAccounts;
    var userData = linkedAccounts.has(message.author.id) ? linkedAccounts.get(message.author.id) : undefined

    if (!userData) return replyChannel.send(message.author+" please link your Nexus Mods and Discord accounts before adding mods. See `!nexus help link` for more information.").catch(console.error)

    var responseMessage = await replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""} Searching for "${args.join(" ")}"...`).catch(console.error)
     
    var updatedModCount = 0;
    //Find the mod. 
    try {
        var searchResults = await nexusAPI.quicksearch(args.join(" "), 1);
        //START TEST ******
        var filteredResults = await searchResults.results ? searchResults.results.filter(m => m.user_id === userData.nexusID) : undefined;
        var ownedMod = [];
        var newModData = [];
        //Stop processing if there are no results.
        if (filteredResults.length === 0) return responseMessage.edit(`Could not locate a mod attached to your account for the query: "${args.join(" ")}"`);

        //Update mods and identify new mods.
        for (i=0; i < filteredResults.length; i ++){
            var result = filteredResults[i];
            if (userData.mods.find(u=> u.domain === result.game_name && result.url.endsWith(u.modid))) {
                console.log(`${result.name} is already linked to ${userData.nexusName}, updating download stats.`);
                var modEntry = userData.mods.find(u=> u.domain === result.game_name && result.url.endsWith(u.modid));
                userData.nexusModDownloadTotal += (result.downloads - modEntry.downloads);
                modEntry.downloads = result.downloads;
                updatedModCount ++;
            }
            else {
                try {
                    //Get game info and push to the array.
                    var gameInfo = await nexusAPI.gameInfo(message.author, result.game_name);
                    result.gameTitle = gameInfo.name;
                    newModData.push(result);
                    //Add to the object array.
                    console.log(`Preparing to add ${result.name} to ${userData.nexusName}`);
                    var modObject = {name: result.name, downloads: result.downloads,game: result.gameTitle,domain: result.game_name,modid:(result.url.substring(result.url.lastIndexOf('/')+1,result.url.length)), url: "https://www.nexusmods.com"+result.url}
                    userData.nexusModDownloadTotal += result.downloads;
                    ownedMod.push(modObject);
                }
                catch(err) { console.log(err);};
            };
        };

        //Merge the arrays.
        userData.mods = userData.mods.concat(ownedMod);
        userData.mods.sort(compare);
        userData.lastupdate = new Date();
        linkedAccounts.set(`${message.author.id}`, userData);
        console.log(`Added ${ownedMod.length} mods to ${userData.nexusName} and updated ${updatedModCount} mod(s)`);

        if (ownedMod.length === 0) return responseMessage.edit(`Could not find any mods not yet linked to your account for the query: "${args.join(" ")}" ${updatedModCount ? `\nUpdated download counts for ${updatedModCount} mods already linked to your account.` : ""}`);
        else {
            var addSuccessEmbed = new Discord.RichEmbed()
            .setTitle(ownedMod.length+" mod(s) added successfully")
            .setColor(0xda8e35)
            .setAuthor(userData.nexusName,message.author.avatarURL,`https://www.nexusmods.com/users/${userData.nexusID}`)
            .setDescription(`Added ${ownedMod.length} mods to [${userData.nexusName}](https://www.nexusmods.com/users/${userData.nexusID}) (Discord account: ${message.author})${updatedModCount ? ` and updated the download counts for ${updatedModCount} existing mods.`:"."}`)
            var newModsList = ""
            for (i = 0; i < ownedMod.length && newModsList.length < 950; i++) {
                newModsList = newModsList + `[${ownedMod[i].name} for ${ownedMod[i].gameTitle}](https://nexusmods.com${newModData[0].url}) - ${Number(ownedMod[i].downloads).toLocaleString()} downloads\n`;
            }
            addSuccessEmbed.addField("Added mods", newModsList)
            .setThumbnail(`https://staticdelivery.nexusmods.com${newModData[0].image}`)
            .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);

            //Send the update message.
            responseMessage.edit(replyChannel !== message.channel ? message.author : "",addSuccessEmbed);

            //Update roles
            link.updateRoles(client, message.author);

        }
    }
    catch (err) {
        console.log(err)
        //return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""}Quicksearch encountered an error. Please try again later.`);
        return responseMessage.edit(`Quicksearch encountered an error. Please try again later.`)
    }
}

function compare(a, b) {
    if (a.downloads > b.downloads) return -1
    else if (a.downloads < b.downloads)  return 1
}



// async function processURLs(modLinks) {
//     resultArray = []
//     splitArray = modLinks.split(",")
//     console.log("Broken down URLs into:"+splitArray.toString())

//     for (i=0; i < splitArray.length; i++) {
//         linkToProcess = splitArray[i].toString()
//         linkToProcess = linkToProcess.replace("https://", "")
//         linkToProcess = linkToProcess.replace("www.", "")
//         linkToProcess = linkToProcess.replace("nexusmods.com/", "")
//         linkToProcess = linkToProcess.replace("mods/", "")
//         linkToProcess = linkToProcess.replace("?tab", "/")
//         linkToProcess = linkToProcess.split("/")
//         let gameName = linkToProcess[0]
//         let modID = linkToProcess[1]
//         console.log(`gameName: ${gameName}, ID: ${modID}`)
//         modArray.push({game: gameName, ID: modID})
//     }

//     return modArray
// }