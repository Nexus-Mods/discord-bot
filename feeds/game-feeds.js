const Discord = require('discord.js');
const { deleteGameFeed, getAllGameFeeds, getUserByDiscordId, updateGameFeed } = require('../api/bot-db.js');
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
        const discordId = gameFeed.owner;
        const discordUser = client.users.find(u => u.id === discordId);
        const userData = getUserByDiscordId(discordId);
        const feedGuild = client.guilds.find(g => g.id === gameFeed.guild);
        const feedChannel = feedGuild ? guild.channels.find(c => c.id === gameFeed.channel) : undefined;
        const webHook = feedGuild ? new Discord.WebhookClient(gameFeed.webhook_id, gameFeed.webhook_token) : undefined;
        const botPermissions = feedGuild? feedChannel.memberPermissions(feedGuild.members.find(client.user)) : [];

        // Check we can actually post to the game feed channel.
        if (botPermissions.indexOf("SEND_MESSAGES") !== -1) {
            await deleteGameFeed(gameFeed._id);
            console.log(`${new Date().toLocaleString()} - Deleted game update ${gameFeed._id} due to missing permissions.`);
            return discordUser.send(`I'm not able to post ${gameFeed.title} updates to ${feedChannel} in ${feedGuild} anymore as I do not have permission to post there. Game feed cancelled.`).catch(console.error);
        }
        // Check if the channel or server doesn't exist.
        if (!feedGuild || !feedChannel) {
            await deleteGameFeed(gameFeed._id);
            console.log(`${new Date().toLocaleString()} - Deleted game update ${gameFeed._id} due to missing guild or channel data.`)
            return discordUser.send(`I'm not able to post ${gameFeed.title} updates to ${feedChannel} in ${feedGuild} anymore as the channel or server could not be found. Game feed cancelled.`).catch(console.error);
        }
        // Check if the user is missing.
        if (!discordUser || !userData) {
            if (feedChannel) feedChannel.send(`**Cancelled Game Feed for ${gameFeed.title} as the user who created it could not be found.**`)
            await deleteGameFeed(gameFeed._id);
            return console.log(`${new Date().toLocaleString()} - GameFeed ${gameFeed._id} - User does not exist. Deleted feed.`);
        }

        // Check the user's API key is valid. 
        try {await nexusAPI.validate(userData.apikey)}
        catch(err) {
            if(err.indexOf("401") !== -1) {
                await deleteGameFeed(gameFeed._id);
                console.log(`${new Date().toLocaleString()} - Deleted game update ${gameFeed._id} due to invalid API key.`)
                return discordUser.send(`${new Date().toLocaleString()} - Cancelled Game Feed for ${gameFeed.title} in ${feedGuild} as your API key is invalid.`).catch(err => undefined)
            }
            else return console.log(`${new Date().toLocaleString()} - Unable to post ${gameFeed.title} updates in ${feedGuild}. API returned an error on validating. \n${err}`).catch(err => undefined);
        };


        // Get the games list if we don't already have it.
        if (!allGames) allGames = await nexusAPI.games(userData, false);

        // Get current game data.
        const currentGame = allGames.find(g => g.domain === gameFeed.domain);

        // Get the updated mods for game. 
        try {
            const newMods = await nexusAPI.updatedMods(userData, gamFeed.domain, "1d");
            // Filter out mods that were check on a previous loop. Sort the updates by date as the API sometimes returns them out of order.
            let filteredNewMods = newMods.filter(mod => mod.latest_file_update > gameFeed.last_timestamp && mod.available).sort(compareDates);
            // Exit if there's nothing to process.
            if (!filteredNewMods.length) return console.log(`${new Date().toLocaleString()} - No unchecked updates for ${gameFeed.title} in ${feedGuild} (${gameFeed._id})`);
            // Prepare to recieve embeds.
            let modEmbeds = [];

            // Loop through each mod and build embeds.
            for (const newMod of filteredNewMods) {
                // We only want 10 at a time. 
                if (modEmbeds.length >= 10) return;
                const modData = await nexusAPI.modInfo(userData, gameFeed.domain, newMod.mod_id);
                // Skip adult content if disabled.
                if (modData.contains_adult_content && !gameFeed.nsfw) return console.log(`${new Date().toLocaleString()} - Skipped ${modData.name || modData.id} for ${gameFeed.title} in ${feedGuild} as it contains NSFW content. (${gameFeed._id})`);
                // Skip non-adult content if disabled.
                if (!modData.contains_adult_content && !gameFeed.sfw) return console.log(`${new Date().toLocaleString()} - Skipped ${modData.name || modData.id} for ${gameFeed.title} in ${feedGuild} as it contains SFW content. (${gameFeed._id})`);
                // Check if this mod is new or updated and if we should post it.
                if ((modInfo.updated_timestamp - modInfo.created_timestamp) < 3600 && gameFeed.show_new) {
                    modEmbeds.push(createModEmbed(modData, currentGame, true));
                    gameFeed.last_timestamp = newMod.latest_file_update;
                }
                else if (gameFeed.show_updates) {
                    // We want to try and get the changelogs.
                    const changelog = await nexusAPI.modChangelogs(userData, gameFeed.domain, newMod.mod_id).catch(err => undefined);
                    modEmbeds.push(createModEmbed(modData, currentGame, false, changelog));                    
                }
            }
        }
        catch(err) {
            console.log("Error processing game feed", err);
        }

        await updateGameFeed(gameFeed._id, {last_update: gameFeed.last_update});

        // No updates to post?
        if (!modEmbeds.length) return console.log(`${new Date().toLocaleString()} - No matching updates for ${gameFeed.title} in ${feedGuild} (${gameFeed._id})`)

        // Post embeds to the web hook.
        if (gameFeed.message) feedChannel.send(gameFeed.message).catch(err => undefined);
        if (webHook) return webHook.send({embeds: modEmbeds, split: true}).catch(console.error);
        else {
            // Webhook isn't working, attempt to post manually.
            console.log(`${new Date().toLocaleString()} - Unable to use webhook, attempting manual posting of updates in ${feedGuild}. (${gameFeed._id})`);
            modEmbeds.forEach((mod) => feedChannel.send(mod).catch(err => undefined));
        }

    }

}


function compareDates(a, b) {
    if (a.latest_file_update > b.latest_file_update) return 1
    else if (a.latest_file_update < b.latest_file_update)  return -1
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

function sanitiseBreaks(string) {
    while (string.indexOf("<br />") !== -1) {
        string = string.replace("<br />",'\n');
    };
    return string
}

/*
Structure of a gamefeed:
New  = {
            id: //NEW unique index.
            channel: message.channel.id,
            webhook_id: wb_id,
            webhook_token: wb_token,
            guild: message.guild.id,
            owner: message.author.id, //Was "user"
            domain: gameToSubscribe.domain_name, //was "game"
            title: gameToSubscribe.name,//was "gameTitle"
            nsfw: //was settings.nsfw
            sfw: //was settings.sfw
            message: //was announceMsg
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