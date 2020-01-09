const Discord = require('discord.js');
const { getAllGameFeeds, getUserByDiscordId } = require('../api/bot-db.js');
const nexusAPI = require('../api/nexus-discord.js');
const pollTime = (1000*60*10); //10 mins
let client;

// Game watcher
exports.run = async (cl) => {
    client = cl;
    await checkForGameUpdates()
    setInterval(checkForGameUpdates, pollTime);
    console.log(`${new Date()} - Game updates scheduled every ${delay/60/1000} minutes.`);
}

async function checkForGameUpdates() {
    // Routinely check for new mods across registered games.
    const allGameFeeds = await getAllGameFeeds();
    let allGames // fill this from the first user with their API key. 

    for (gameFeed of allGameFeeds) {
        // Run the check for each game and post results. 
    }

}



function createModEmbed(modInfo, game, newMod, changeLog = undefined) {
    //Build the embed for posting.
    console.log(`Building embed for ${modInfo.name} (${modInfo.mod_id}) for ${game.name} last edit ${new Date(modInfo.updated_timestamp*1000)} (${modInfo.updated_timestamp})`) 
    let embed = new Discord.RichEmbed()
    .setAuthor(`${newMod ? "New Mod Upload" : "Updated Mod"} (${game.name})`,client.user.avatarURL)
    .setTitle(modInfo.name || "Name not found")
    .setColor(newMod? 0xda8e35 : 0x57a5cc)
    .setURL(`https://www.nexusmods.com/${modInfo.domain_name}/mods/${modInfo.mod_id}`)
    .setDescription(sanitiseBreaks(modInfo.summary))
    .setImage(modInfo.picture_url)
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`)
    if (changeLog && Object.keys(changeLog).find(id => modInfo.version === id)) {
        let versionChanges = changeLog[Object.keys(changeLog).find(id => modInfo.version === id)].join("\n");
        if (versionChanges.length > 1024) versionChanges = versionChanges.substring(0,1020)+"..."
        embed.addField("Changelog", versionChanges);
    }
    embed.addField("Author", modInfo.author, true)
    .addField("Uploader", `[${modInfo.uploaded_by}](${modInfo.uploaded_users_profile_url})`, true)
    .addField("Category", game.categories.find(c => c.category_id === modInfo.category_id).name,true)
    .addField("Mod ID", modInfo.mod_id,true)
    .setTimestamp(modInfo.updated_timestamp*1000)
    .setFooter("Version: "+modInfo.version,client.user.avatarURL);

    return embed
}

/*
Structure of a gamefeed:
New  = {
            channel: message.channel.id,
            webhook_id: wb_id,
            webhook_token: wb_token,
            guild: message.guild.id,
            owner: message.author.id, //Was "user"
            domain: gameToSubscribe.domain_name, //was "game"
            title: gameToSubscribe.name,//was "gameTitle"
            nsfw: //was settings.nsfw
            sfw: //was settings.sfw
            show_new: //was settings.newMods
            show_updates: //was settings.updatedMods
            last_timestamp: 0, //time the feed was last updated. 
            created: Math.round((new Date()).getTime() / 1000)//current Unix timestamp.
        };


Old = {
            channel: message.channel.id,
            webhook_id: wb_id,
            webhook_token: wb_token,
            guild: message.guild.id,
            user: message.author.id,
            game: gameToSubscribe.domain_name,
            gameTitle: gameToSubscribe.name,
            settings: {
                nsfw: allowAdultContent,
                sfw: true,
                newMods: true,
                updatedMods: true
            },
            lastTimestamp: 0,
            created: Math.round((new Date()).getTime() / 1000)//current Unix timestamp.
        };
*/