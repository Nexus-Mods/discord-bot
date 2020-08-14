const Discord = require('discord.js');
const { deleteGameFeed, getAllGameFeeds, getUserByDiscordId, getUserByNexusModsName, updateGameFeed } = require('../api/bot-db.js');
const nexusAPI = require('../api/nexus-discord.js');
const pollTime = (1000*60*10); //10 mins
let client;

// Game watcher
exports.run = async (cl) => {
    client = cl;
    await checkForGameUpdates().catch((err) => console.warn('Game feeds aborted', err));
    setInterval(checkForGameUpdates.catch((err) => console.warn('Game feeds aborted', err)), pollTime);
    console.log(`${new Date().toLocaleString()} - Game updates scheduled every ${pollTime/60/1000} minutes.`);
}

async function checkForGameUpdates() {
    // Routinely check for new mods across registered games.
    const allGameFeeds = await getAllGameFeeds();
    let allGames // fill this from the first user with their API key. 

    console.log(`${new Date().toLocaleString()} - Found ${allGameFeeds.length} game feeds, checking for updates.`);

    for (gameFeed of allGameFeeds) {
        // Run the check for each game and post results. 
        const discordId = gameFeed.owner;
        const discordUser = client.users.find(u => u.id === discordId);
        const userData = await getUserByDiscordId(discordId);
        const feedGuild = client.guilds.find(g => g.id === gameFeed.guild);
        const feedChannel = feedGuild ? feedGuild.channels.find(c => c.id === gameFeed.channel) : undefined;
        const webHook = feedGuild ? new Discord.WebhookClient(gameFeed.webhook_id, gameFeed.webhook_token) : undefined;
        const botMember = feedGuild ? feedGuild.members.find(m => m.id === client.user.id): undefined;
        const botPermissions = feedGuild? await feedChannel.permissionsFor(botMember) : undefined; //Got to get the bitfield, as this doesn't resolve to searchable perms.

        console.log(`${new Date().toLocaleString()} - Checking game feed ${gameFeed._id} for updates (${gameFeed.title}): ${feedGuild}`);

        // Check we can actually post to the game feed channel.
        if (botPermissions && !botPermissions.has('SEND_MESSAGES', true)) {
            if (client.config.testing) continue;
            await deleteGameFeed(gameFeed._id);
            console.log(`${new Date().toLocaleString()} - Deleted game update #${gameFeed._id} (${gameFeed.title}) due to missing permissions.`);
            discordUser.send(`I'm not able to post ${gameFeed.title} updates to ${feedChannel} in ${feedGuild} anymore as I do not have permission to post there. Game feed cancelled.`).catch(() => undefined);
            continue;
        }

        if (discordUser && (!feedGuild || !feedChannel)) {
            if (client.config.testing) continue;
            await deleteGameFeed(gameFeed._id);
            console.log(`${new Date().toLocaleString()} - Deleted game update #${gameFeed._id} (${gameFeed.title}) due to missing guild or channel data.`)
            discordUser.send(`I'm not able to post ${gameFeed.title} updates to ${feedChannel} in ${feedGuild} anymore as the channel or server could not be found. Game feed cancelled.`).catch(() => undefined);
            continue;
        }
        // Check if the user is missing.
        if (!discordUser || !userData) {
            if (client.config.testing) continue;
            if (feedChannel) feedChannel.send(`**Cancelled Game Feed for ${gameFeed.title} as the user who created it could not be found.**`)
            await deleteGameFeed(gameFeed._id);
            console.log(`${new Date().toLocaleString()} - GameFeed #${gameFeed._id} (${gameFeed.title}) - User does not exist. Deleted feed.`);
            continue;
        }

        // Check the user's API key is valid. 
        try {await nexusAPI.validate(userData.apikey)}
        catch(err) {
            if(err.indexOf("401") !== -1) {
                if (client.config.testing) continue;
                await deleteGameFeed(gameFeed._id);
                console.log(`${new Date().toLocaleString()} - Deleted game update #${gameFeed._id} (${gameFeed.title}) due to invalid API key.`)
                discordUser.send(`${new Date().toLocaleString()} - Cancelled Game Feed for ${gameFeed.title} in ${feedGuild} as your API key is invalid.`).catch(() => undefined);
            }
            else console.log(`${new Date().toLocaleString()} - Unable to post ${gameFeed.title} updates in ${feedGuild}. API returned an error on validating. \n${err}`).catch(() => undefined);
            continue;
        };


        // Get the games list if we don't already have it.
        if (!allGames) allGames = await nexusAPI.games(userData, false);

        // Get current game data.
        const currentGame = allGames.find(g => g.domain_name === gameFeed.domain);

        // Get the updated mods for game. 
        try {
            const newMods = await nexusAPI.updatedMods(userData, gameFeed.domain, "1w");
            // Filter out mods that were check on a previous loop. Sort the updates by date as the API sometimes returns them out of order.
            const lastTimestampEpoc = Math.floor(gameFeed.last_timestamp / 1000); //Need to convert to EPOC to compare.
            let filteredNewMods = newMods.filter(mod => mod.latest_file_update > lastTimestampEpoc).sort(compareDates);
            // Exit if there's nothing to process.
            if (!filteredNewMods.length) {
                console.log(`${new Date().toLocaleString()} - No unchecked updates for ${gameFeed.title} in ${feedGuild} (${gameFeed._id})`);
                continue;
            };
            // Prepare to recieve embeds.
            let modEmbeds = [];
            let lastUpdateDate = new Date(0);

            // Loop through each mod and build embeds.
            for (const newMod of filteredNewMods) {
                // We only want 10 at a time. 
                if (modEmbeds.length >= 10) break;
                let modData = await nexusAPI.modInfo(userData, gameFeed.domain, newMod.mod_id)
                    .catch((err) => { 
                        console.error(`${new Date().toLocaleString()} - Could not get mod data for ${gameFeed.domain}/${newMod.mod_id}`, err);
                    });
                // Exit if modData is unfilled.
                if (!modData) continue;
                
                // Skip unavailable mods.
                if (modData.status !== "published") { 
                    // console.log(`${new Date().toLocaleString()} - Skipped ${modData.name || `Mod #${modData.mod_id}`} for ${gameFeed.title} in ${feedGuild} as it is not available. (${gameFeed._id})`);
                    continue;
                };
                // Skip adult content if disabled.
                if (modData.contains_adult_content && !gameFeed.nsfw) {
                    // console.log(`${new Date().toLocaleString()} - Skipped ${modData.name || modData.id} for ${gameFeed.title} in ${feedGuild} as it contains NSFW content. (${gameFeed._id})`);
                    continue;
                };
                // Skip non-adult content if disabled.
                if (!modData.contains_adult_content && !gameFeed.sfw) {
                    // console.log(`${new Date().toLocaleString()} - Skipped ${modData.name || modData.id} for ${gameFeed.title} in ${feedGuild} as it contains SFW content. (${gameFeed._id})`);
                    continue;
                };
                // Get the Discord ID of the author, if possible (and they're in this server.)
                const authorData = await getUserByNexusModsName(modData.uploaded_by).catch(() => undefined);
                modData.authorDiscord = authorData ? await feedGuild.members.find(m => m.id === authorData.d_id) : undefined;

                // Check if this mod is new or updated and if we should post it.
                if ((modData.updated_timestamp - modData.created_timestamp) < 3600 && gameFeed.show_new) {
                    // console.log(`${new Date().toLocaleString()} - Building new mod embed for ${modData.name} (${modData.mod_id}) for ${currentGame.name} (${gameFeed._id})`); 
                    modEmbeds.push(createModEmbed(modData, currentGame, true, undefined, gameFeed.compact));
                    lastUpdateDate = new Date(modData.created_timestamp*1000);
                }
                else if (gameFeed.show_updates) {
                    // We want to try and get the changelogs.
                    const changelog = await nexusAPI.modChangelogs(userData, gameFeed.domain, newMod.mod_id).catch(() => undefined);
                    // console.log(`${new Date().toLocaleString()} - Building updated mod embed for ${modData.name} (${modData.mod_id}) for ${currentGame.name} (${gameFeed._id})`);
                    modEmbeds.push(createModEmbed(modData, currentGame, false, changelog, gameFeed.compact));
                    lastUpdateDate = new Date(modData.updated_timestamp*1000);         
                }
            }
            await updateGameFeed(gameFeed._id, {last_timestamp: lastUpdateDate});

            // No updates to post?
            if (!modEmbeds.length) {
                console.log(`${new Date().toLocaleString()} - No matching updates for ${gameFeed.title} in ${feedGuild} (${gameFeed._id})`);
                continue;
            }
    
            // Post embeds to the web hook.
            if (gameFeed.message) feedChannel.send(gameFeed.message).catch(() => undefined);

            console.log(`${new Date().toLocaleString()} - Posting ${modEmbeds.length} updates for ${gameFeed.title} in ${feedGuild} (${gameFeed._id})`);

            webHook.send({embeds: modEmbeds, split: true}).catch(() => {
                console.log(`${new Date().toLocaleString()} - Unable to use webhook, attempting manual posting of updates in ${feedGuild}. (${gameFeed._id})`);
                modEmbeds.forEach((mod) => feedChannel.send(mod).catch(() => undefined));

            });
        }
        catch(err) {
            console.log("Error processing game feed", err);
        }

    }

}


function compareDates(a, b) {
    if (a.latest_file_update > b.latest_file_update) return 1
    else if (a.latest_file_update < b.latest_file_update)  return -1
}


function createModEmbed(modInfo, game, newMod, changeLog = undefined, compact) {
    const gameThumbURL = `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`;
    const category = game.categories.find(c => c.category_id === modInfo.category_id).name;

    //Build the embed for posting.
    let embed = new Discord.RichEmbed()
    .setAuthor(`${newMod ? "New Mod Upload" : "Updated Mod"} (${game.name})`,client.user.avatarURL)
    .setTitle(modInfo.name || "Name not found")
    .setColor(newMod? 0xda8e35 : 0x57a5cc)
    .setURL(`https://www.nexusmods.com/${modInfo.domain_name}/mods/${modInfo.mod_id}`)
    .setDescription(sanitiseBreaks(modInfo.summary))
    .setImage(!compact ? modInfo.picture_url: '')
    .setThumbnail(compact ? modInfo.picture_url : gameThumbURL)
    if (changeLog && Object.keys(changeLog).find(id => modInfo.version === id)) {
        let versionChanges = changeLog[Object.keys(changeLog).find(id => modInfo.version === id)].join("\n");
        if (versionChanges.length > 1024) versionChanges = versionChanges.substring(0,1020)+"..."
        embed.addField("Changelog", versionChanges);
    }
    embed.addField("Author", modInfo.author, true)
    .addField("Uploader", `[${modInfo.uploaded_by}](${modInfo.uploaded_users_profile_url})${modInfo.authorData ? `\n<@${modInfo.authorDiscord}>`: ''}`, true)
    .addField("Category",category, true)
    .setTimestamp(modInfo.updated_timestamp*1000)
    .setFooter(`Version: ${modInfo.version} - Mod ID: ${game.id}-${modInfo.mod_id}`,client.user.avatarURL);

    return embed;
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