const Discord = require('discord.js');
const { getUserByDiscordId, updateUser, getModsbyUser, updateMod, createMod } = require('../api/bot-db.js');
const nexusAPI = require('../api/nexus-discord.js');

module.exports.help = {
    name: "addmod",
    description: "Allows authors to show mods on their profile cards in Discord.\nCan also be used to gain 'Mod Author' status on servers.",
    usage: "[full mod title]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

exports.run = async (client, message, args, serverData) => {
    //Get reply channel from server settings.
    const replyChannel = serverData && serverData.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel;
    const discordId = message.author.id;

    let userData = await getUserByDiscordId(discordId);

    if (!userData) return replyChannel.send(`${replyChannel === message.channel ? message.author.tag : message.author} please link your Nexus Mods account to use this feature. See \`!nexus link\` for more information.`).catch(console.error);

    if (args.length === 0) return replyChannel.send(`${replyChannel === message.channel ? message.author.tag : message.author}, to link a mod to your Discord account type \`!nexus addmod <mod title>\`.`).catch(console.error);

    let responseMessage = await replyChannel.send(`${replyChannel === message.channel ? "" : message.author +". "}Searching all mods for "${args.join(" ")}"...`).catch(console.error);


    let updatedModCount = 0;
    let userMods = await getModsbyUser(userData.id);
    let newMods = [];
    // Find any mods with this term that are created by this user. 
    try {
        console.log(`${new Date().toLocaleString()} - Looking for mods with query "${args.join(" ")}" requested by ${userData.name} in ${message.guild || 'a DM'}.`);
        const gameList = await nexusAPI.games(userData, false);
        const searchResult = await nexusAPI.quicksearch(args.join(" "), 1);
        const filteredResults = searchResult.results ? searchResult.results.filter(m => m.user_id === userData.id) : [];
        

        // We can exit if nothing was found. 
        if (filteredResults.length === 0) return responseMessage.edit(`Could not locate a mod owned by ${userData.name} for the query: "${args.join(" ")}".`);

        for (i=0; i < filteredResults.length; i ++){ //filteredResults.forEach(async (result) => {
            let result = filteredResults[i];
            // Is the result already saved to our profile?
            if (userMods.find(m => m.domain === result.game_name && result.url.endsWith(m.modid))) {
                console.log(`${new Date().toLocaleString()} - ${result.name} is already linked to ${userData.name}, updating download stats.`);
                // UPDATE STATS
                let modEntry = userMods.find(m => m.domain === result.game_name && result.url.endsWith(m.modid));
                const gameId = gameList.find(g => g.domain_name === result.game_name).id;
                const downloadData = await nexusAPI.getDownloads(userData, modEntry.domain, gameId, modEntry.modid);
                //console.log("Saved mod download data:"+JSON.stringify(downloadData, null ,2))
                await updateMod(modEntry, downloadData);
                // modEntry.unique_downloads = downloadData.unique_downloads;
                // modEntry.total_downloads = downloadData.total_downloads;
                updatedModCount += 1
            }
            // Add a new mod to our profile.
            else {
                const gameId = gameList.find(g => g.domain_name === result.game_name).id
                const downloadData = await nexusAPI.getDownloads(userData, result.game_name, gameId, (result.url.substring(result.url.lastIndexOf('/')+1,result.url.length)));
                //console.log("New mod download data:"+JSON.stringify(downloadData, null ,2))

                const newMod = {
                    domain: result.game_name,
                    mod_id: (result.url.substring(result.url.lastIndexOf('/')+1,result.url.length)),
                    name: result.name,
                    game: gameList.find(g => g.domain_name === result.game_name).name,
                    unique_downloads: downloadData.unique_downloads,
                    total_downloads: downloadData.total_downloads,
                    path: (result.url.substring(result.url.indexOf(result.game_name), result.url.legth)),
                    owner: userData.id
                }

                console.log(`${new Date().toLocaleString()} - Adding ${newMod.name} to ${userData.name}.`);
                await createMod(newMod);
                newMods.push(newMod);
            }
        };

        if (newMods.length === 0) return responseMessage.edit(`Could not find any new mods that are not currently linked to your account. ${updatedModCount ? `Updated download stats for ${updatedModCount} mods.`:""}`).catch(console.error);
        else {
            let addedModsEmbed = new Discord.RichEmbed()
            .setTitle(newMods.length+" mod(s) added successfully")
            .setColor(0xda8e35)
            .setAuthor(userData.name,message.author.avatarURL,`https://www.nexusmods.com/users/${userData.id}`)
            .setDescription(`Added ${newMods.length} mods to [${userData.name}](https://www.nexusmods.com/users/${userData.id}) (Discord account: ${message.author})${updatedModCount ? ` and updated the download counts for ${updatedModCount} existing mods.`:"."}`);
            let newModList = "";
            for(i =0; i < newMods.length && newModList.length < 950; i++) {
                newModList = newModList + `[${newMods[i].name} for ${newMods[i].game}](${newMods[i].url}) - ${Number(newMods[i].unique_downloads).toLocaleString()} downloads\n`;
            }
            addedModsEmbed.addField("Added mods", newModList)
            .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);

            // Update the message
            responseMessage.edit(replyChannel !== message.channel ? message.author : "",addedModsEmbed).catch(console.error);

            // Update Mod Author roles - TODO!

        }
        

    }
    catch(err) {
        responseMessage.edit("An error occurred with your request.\n```"+err+"```")
    }
}