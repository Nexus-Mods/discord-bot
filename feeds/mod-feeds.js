const Discord = require('discord.js');
const { deleteModFeed, getAllModFeeds, getUserByDiscordId, getUserByNexusModsName, updateModFeed } = require('../api/bot-db.js');
const nexusAPI = require('../api/nexus-discord.js');
const pollTime = (1000*60*60); //1 hrs
let client;

// Game watcher
exports.run = async (cl) => {
    // return console.log(`${new Date().toLocaleString()} - Mod Feeds are not yet available.`)
    client = cl;
    await checkForModUpdates()
    setInterval(checkForModUpdates, pollTime);
    console.log(`${new Date().toLocaleString()} - Mod updates scheduled every ${pollTime/60/1000} minutes.`);
}

async function checkForModUpdates() {
    // Routinely check for new mods across registered games.
    const allModFeeds = await getAllModFeeds();
    let allGames // fill this from the first user with their API key. 
    let cachedUpdates = {}; // save recently updated info rather than requesting it each time.

    for (modFeed of allModFeeds) {
        // Run the check for each game and post results. 
        const discordId = modFeed.owner;
        const discordUser = client.users.find(u => u.id === discordId);
        const userData = await getUserByDiscordId(discordId);
        const feedGuild = client.guilds.find(g => g.id === modFeed.guild);
        const feedChannel = feedGuild ? feedGuild.channels.find(c => c.id === modFeed.channel) : undefined;
        const botPermissions = feedGuild? feedChannel.memberPermissions(feedGuild.me) : [];

        // Check we can actually post to the game feed channel.
        if (!botPermissions.has("SEND_MESSAGES", true)) {
            await deleteModFeed(modFeed._id);
            console.log(`${new Date().toLocaleString()} - Deleted mod feed ${modFeed._id} due to missing permissions.`);
            discordUser.send(`I'm not able to post ${modFeed.title} updates to ${feedChannel} in ${feedGuild} anymore as I do not have permission to post there. Game feed cancelled.`).catch(console.error);
            continue;
        }
        // Check if the channel or server doesn't exist.
        if (!feedGuild || !feedChannel) {
            await deleteModFeed(modFeed._id);
            console.log(`${new Date().toLocaleString()} - Deleted game update ${modFeed._id} due to missing guild or channel data.`)
            discordUser.send(`I'm not able to post ${modFeed.title} updates to ${feedChannel || 'Unknown channel'} in ${feedGuild || 'Unknown server'} anymore as the channel or server could not be found. Game feed cancelled.`).catch(console.error);
            continue;
        }
        // Check if the user is missing.
        if (!discordUser || !userData) {
            if (feedChannel) feedChannel.send(`**Cancelled Game Feed for ${modFeed.title} as the user who created it could not be found.**`)
            await deleteModFeed(modFeed._id);
            return console.log(`${new Date().toLocaleString()} - ModFeed ${modFeed._id} - User does not exist. Deleted feed.`);
        }

        // Check the user's API key is valid. 
        try {await nexusAPI.validate(userData.apikey)}
        catch(err) {
            if(err.toString().indexOf("401") !== -1) {
                await deleteModFeed(modFeed._id);
                console.log(`${new Date().toLocaleString()} - Deleted game update ${modFeed._id} due to invalid API key.`)
                return discordUser.send(`${new Date().toLocaleString()} - Cancelled Game Feed for ${modFeed.title} in ${feedGuild} as your API key is invalid.`).catch(err => undefined)
            }
            else return console.log(`${new Date().toLocaleString()} - Unable to post ${modFeed.title} updates in ${feedGuild}. API returned an error on validating. \n${err}`).catch(err => undefined);
        };


        // Get the games list if we don't already have it.
        if (!allGames) allGames = await nexusAPI.games(userData, false);

        // Get current game data.
        const currentGame = allGames.find(g => g.domain_name === modFeed.domain);

        // Get the updated mods for game. 
        try {
            const newMods = cachedUpdates[modFeed.domain] || await nexusAPI.updatedMods(userData, modFeed.domain, "1w");
            // Save this list of updated mods so we don't need to check it again. 
            if (!cachedUpdates[modFeed.domain_name]) cachedUpdates[modFeed.domain] = newMods;
            

            const modUpdate = newMods.find(m => m.mod_id === modFeed.mod_id);
            // If the mod has not been updated recently, back out of the process.
            if (!modUpdate) {
                console.log(`${new Date().toLocaleString()} - ${modFeed.title} has not been in the last week ${feedGuild} (${modFeed._id})`);
                continue;
            }
            
            // Convert last_update to an EPOC
            const lastUpdateEpoc = modFeed.last_timestamp.getTime() / 1000;
            // If there's nothing new since the last update we can exit.
            if (lastUpdateEpoc > modUpdate.latest_file_update && lastUpdateEpoc > modUpdate.lastest_mod_activity) {
                console.log(`${new Date().toLocaleString()} - ${modFeed.title} has not been updated recently ${feedGuild} (${modFeed._id})\nLast Update: ${modFeed.last_timestamp}\nMod Update: ${new Data(modUpdate.latest_file_update * 1000)}`);
                continue;
            }
            
            // Now we want to get mod data
            const modData = await nexusAPI.modInfo(userData, modFeed.domain, modFeed.mod_id)
                .catch(err => console.log(`${new Date().toLocaleString()} - Error getting ${modFeed.title} data from the API (${modFeed._id})`, err));

            if (!modData) continue;

            const uploaderData = await getUserByNexusModsName(modData.uploaded_by);
            const uploaderDiscord = uploaderData ? await client.users.find(u => u.id === uploaderData.d_id) : undefined;

            if (!feedChannel.nsfw && modData.contains_adult_content) {
                feedChannel.send(`Cannot post mod update for ||${modFeed.title}|| as this channel is not marked NSFW`);
                continue;
            }

            // If a new file has been updated, we'll want to get the file and changelog data.
            if (modFeed.show_files && lastUpdateEpoc < modUpdate.latest_file_update) {
                modData.files = await nexusAPI.modFiles(userData, modFeed.domain, modFeed.mod_id)
                    .then(result => { return result.files })
                    .catch(() => console.log(`Could not get file info for ${modFeed.title}`));
                const latestFile = modData.files.find(f => f.uploaded_timestamp === modUpdate.latest_file_update);
                const updateFileEmbed = new Discord.RichEmbed()
                .setAuthor(`Mod Updated (${currentGame ? currentGame.name : modFeed.domain})`, `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${currentGame.id}.jpg`)
                .setTitle(`${modFeed.title}`)
                .setURL(`https://nexusmods.com/${modFeed.domain}/${modFeed.mod_id}`)
                .setColor(0xda8e35)
                .setDescription(`Author: [${modData.uploaded_by}](${modData.uploaded_users_profile_url}) ${uploaderDiscord || ''}\n${modData.summary}`)
                .setThumbnail(modData.picture_url)
                .addField(`New File Uploaded`, `[${latestFile.name} (v${latestFile.mod_version})](https://www.nexusmods.com/${modFeed.domain}/mods/${modFeed.mod_id}?tab=files&file_id=${latestFile.file_id})`)
                .addField(`Changelog`, latestFile.changelog_html ? latestFile.changelog_html.substring(0,1024) : 'No changelog provided.')
                .setFooter(`ID: ${modFeed._id} | Feed Owner: ${discordUser.tag || '???'}`)
                .setTimestamp(latestFile.uploaded_time);

                feedChannel.send(modFeed.message || '', updateFileEmbed).catch(() => null);
                continue;
            }



            // return console.log("modData", !!modData);
            // If ()

            // Get the mod data.



            // Prepare to recieve embeds.
            let modEmbeds = [];

            // Loop through each mod and build embeds.
            for (const newMod of filteredNewMods) {
                // We only want 10 at a time. 
                if (modEmbeds.length >= 10) return;
                const modData = await nexusAPI.modInfo(userData, modFeed.domain, newMod.mod_id);
                // Skip adult content if disabled.
                if (modData.contains_adult_content && !modFeed.nsfw) return console.log(`${new Date().toLocaleString()} - Skipped ${modData.name || modData.id} for ${modFeed.title} in ${feedGuild} as it contains NSFW content. (${modFeed._id})`);
                // Skip non-adult content if disabled.
                if (!modData.contains_adult_content && !modFeed.sfw) return console.log(`${new Date().toLocaleString()} - Skipped ${modData.name || modData.id} for ${modFeed.title} in ${feedGuild} as it contains SFW content. (${modFeed._id})`);
                // Check if this mod is new or updated and if we should post it.
                if ((modInfo.updated_timestamp - modInfo.created_timestamp) < 3600 && modFeed.show_new) {
                    modEmbeds.push(createModEmbed(modData, currentGame, true));
                    modFeed.last_timestamp = newMod.latest_file_update;
                }
                else if (modFeed.show_updates) {
                    // We want to try and get the changelogs.
                    const changelog = await nexusAPI.modChangelogs(userData, modFeed.domain, newMod.mod_id).catch(err => undefined);
                    modEmbeds.push(createModEmbed(modData, currentGame, false, changelog));                    
                }
            }
        }
        catch(err) {
            console.log(`${new Date().toLocaleString()} - Error processing mod feed ${modFeed._id}`, err);
        }

        // await updateModFeed(modFeed._id, {last_update: modFeed.last_update});

        // // No updates to post?
        // if (!modEmbeds.length) return console.log(`${new Date().toLocaleString()} - No matching updates for ${modFeed.title} in ${feedGuild} (${modFeed._id})`)

        // // Post embeds to the web hook.
        // if (modFeed.message) feedChannel.send(modFeed.message).catch(err => undefined);
        // if (webHook) return webHook.send({embeds: modEmbeds, split: true}).catch(console.error);
        // else {
        //     // Webhook isn't working, attempt to post manually.
        //     console.log(`${new Date().toLocaleString()} - Unable to use webhook, attempting manual posting of updates in ${feedGuild}. (${modFeed._id})`);
        //     modEmbeds.forEach((mod) => feedChannel.send(mod).catch(err => undefined));
        // }

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
Structure of a modFeed:
New  = {
            _id: //NEW unique index.
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