const { getUserByDiscordId } = require('../api/users.js');
const { getModFeed, getModFeedsForServer, createModFeed, updateModFeed, deleteModFeed } = require('../api/mod_feeds.js');
const Discord = require("discord.js");
const nexusAPI = require('../api/nexus-discord.js');
const modUrlRegex = /nexusmods.com\/([a-zA-Z0-9]+)\/mods\/([0-9]+)/i


module.exports.help = {
    name: "gamefeed",
    description: "Creates a mod feed in this channel, publishing new or updated mods every 10 minutes.",
    usage: "<mod name or URL>",
    moderatorOnly: true,
    adminOnly: false  
}

exports.run = async (client, message, args) => {
    // Check we're in a server
    if (!message.guild) return message.channel.send("This feature is not available in DMs.").catch(console.error);

    // Check the user is a moderator
    if (!message.member.hasPermission("MANAGE_CHANNELS")) return message.channel.send("You do not have permission to use this feature.");

    const replyMessage = await message.channel.send(`Looking for feed data...`);

    //No args - explain feature, show subs for this channel.
    if (args.length === 0) {
        const tutorialEmbed = new Discord.RichEmbed()
        .setThumbnail(client.user.avatarURL)
        .setTitle("Set up a mod feed")
        .setDescription("Using this feature you can create a feed in this channel which will periodically report changes for a specfied game."+
        "\n\nTo set up the feed add the name or url of the mod to the end of the command e.g. \"Vortex\" or \"https://nexusmods.com/site/mods/1\"."+
        "\n\nAdult content will only be posted if the channel is marked NSFW in Discord."+
        "\n\n*The feed will use the API key linked to your account and can consume approximately 24 - 100 requests per day depending on your settings and the number of updates posted.*")
        .addField("Editing or cancelling feeds", "To edit an existing feed, added edit followed by a hash and the number reference of your feed e.g. `!nexus modfeed edit #1`.")
        .setColor(0xda8e35)
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)


        //Pull all updates for this server.
        const serverFeeds = async (guild) => {
            const feeds = await getModFeedsForServer(guild.id).catch(() => console.log('Error getting mod feeds', err));
            if (!feeds || !feeds.length) return undefined;
            return feeds.map(feed => {
                const user = guild.members.find(m => m.id === feed.owner);
                return `**#${feed._id}** - [${feed.title}](https://nexusmods.com/${feed.domain}/mods/${feed.mod_id}) in <#${feed.channel}> (${user || '*Unknown user*'}).\n🗄️: ${feed.show_files} | 🗒️: ${feed.show_other}`
            });
        } 
        const feeds = await serverFeeds(message.guild)
        const feedMap = feeds.join("\n");
        if (feedMap) tutorialEmbed.addField(`Mod Updates in this server (${feeds.length})`, feedMap.length > 1000 ? feedMap.substring(0, 1000) : feedMap );
        return replyMessage.edit("", tutorialEmbed).catch(console.error);
    }

    //Find linked account
    const userData = await getUserByDiscordId(message.author.id);
    if (!userData) return replyMessage.edit("Please link your Nexus Mods account to your Discord account before using this feature. See `!nexus link` help on linking your account.");

    //CHECK FOR EDITING OPTION. !nexus modfeed edit #{id}
    if (args[0].toLowerCase() === 'edit' && args[1].indexOf('#') === 0) {
        const feedID = args[1].substring(1);
        if (isNaN(feedID)) return replyMessage.edit("Invalid feed ID: "+args[1]);
        let feedObject = await getModFeed(feedID);
        if (!feedObject) return replyMessage.edit("Could not find a feed with ID: "+feedID);
        const owner = message.guild.members.find(m => m.id === feedObject.owner);
        if (message.member !== owner || !message.member.hasPermission("MANAGE_CHANNELS")) return replyMessage.edit("You do not have permission to edit this feed.");
        if (feedObject.guild !== message.guild.id) return replyMessage.edit(`Cannot managed feed #${feedID} as it is not set up in this server.`);

        // Show feed details
        const editMessage = await replyMessage.edit("", editEmbed(feedObject, owner, message, client)).catch(console.error);
        //Check for the 6 toggles
        const toggles = ["✅", "❌", "🗄️", "🗒️", "📬","📭"];
        const reactionFilter = (reaction, user) => user.id === message.author.id && toggles.indexOf(reaction.emoji.name) !== -1;
        const editCollector = editMessage.createReactionCollector(reactionFilter, {time: 30000, max: 15});
        toggles.forEach(emoji => editMessage.react(emoji));

        let newData = {};
        editCollector.on('collect', async r => {
            if (r.emoji.name === '✅') {
                editMessage.clearReactions();
                editCollector.stop("Stopped by user.");
            };
            if (r.emoji.name === '🗄️') {
                newData.show_files = !feedObject.show_files;
                feedObject.show_files = newData.show_files;
                editMessage.edit(`New file uploads ${newData.show_files ? "will" : "will **not**" } be included.`, editEmbed(feedObject, owner, message, client)).catch(console.error);
            };
            if (r.emoji.name === '🗒️') {
                newData.show_other = !feedObject.show_other;
                feedObject.show_other = newData.show_other;
                editMessage.edit(`Updated mods ${feedObject.show_updates ? "will" : "will **not**" } be included.`, editEmbed(feedObject, owner, message, client)).catch(console.error);
            };
            if (r.emoji.name === '❌') {
                editCollector.stop("Deleted by user.");
            };
            if (r.emoji.name === '📬') {
                //Collect a new notification message.
                await message.channel.send("Type the message you would like to send with update alerts.");
                var newMsgCollector = await message.channel.createMessageCollector(m => m.author === message.author, {maxMatches: 1, time: 15000});
                newMsgCollector.on('collect', m => {
                    newData.message = m.content;
                    feedObject.message = m.content;
                    editMessage.edit(`Before each feed update the following message will be sent: "${m.content}"`, editEmbed(feedObject, owner, message, client)).catch(console.error);
                });
                newMsgCollector.on('end', mc => {
                    if (mc.size === 0) message.channel.send("No new message was set.")
                })

            };
            if (r.emoji.name === '📭' && feedObject.announceMsg) {
                newData.message = null;
                feedObject.message = null;
                editMessage.edit("", editEmbed(feedObject, owner, message, client)).catch(console.error);
                message.channel.send("Update message cleared.");
            };
        });
        editCollector.on('end', rc => {
            if (rc.find(r => r.emoji.name === '❌')) {
                //delete the feed
                editMessage.clearReactions();
                return deleteModFeed(feedObject._id)
                .then(() => {
                    editMessage.edit("Mod feed deleted.", { embed: null });
                    console.log(new Date() + ` - Game feed #${feedObject._id} for ${feedObject.title} in ${message.channel.name} at ${message.guild.name} deleted by ${rc.first().users.last().tag}`);
                })
                .catch(err => meditMessage.edit("Error deleting mod feed."+err, { embed: null }));
            }
            else {
                //save the changes
                editMessage.clearReactions();
                return updateModFeed(feedObject._id, newData)
                .then(() => {
                    editMessage.edit("Mod feed saved successfully.", { embed: null })
                    console.log(new Date() + ` - Game feed #${feedObject._id} for ${feedObject.title} in ${message.channel.name} at ${message.guild.name} edited by ${message.author.tag}`);
                })
                .catch(err => editMessage.edit("Error saving mod feed."+err, { embed: null }));
            }

        });

        return;

    }


    // GET THE GAME LIST
    const gameList = await nexusAPI.games(userData).catch(() => console.error(`Could not get games in modfeed command`, err));
    let modData;
    let gameData;

    // IDENIFY MOD BY URL
    if (args.join(" ").match(modUrlRegex)) {
        const match = args.join(" ").match(modUrlRegex);
        const domain = match[1];
        const mod_id = match[2];
        // console.log(`Found matching url for Mod #${mod_id} in ${domain}`);

        gameData = gameList ? gameList.find(g => g.domain_name === domain) : undefined;
        modData = await nexusAPI.modInfo(userData, domain, mod_id)
            .catch((err) => { 
                return message.channel.send(`Error getting mod data.\n\`\`\`${err}\`\`\``);
            });

    }
    // IDENTIFY BY NAME
    else {
        const search = await nexusAPI.quicksearch(args.join(" "), true)
            .catch((err) => {
                return message.channel.send(`Error searching for mods.\n\`\`\`${err}\`\`\``);
            });
        
        // Grab the first match.
        const result = search.results[0];
        // console.log('Quicksearch found the following mod', result.name);
        gameData = gameList ? gameList.find(g => g.domain_name === result.game_name) : undefined;
        modData = await nexusAPI.modInfo(userData, result.game_name, result.mod_id)
            .catch((err) => { 
                return message.channel.send(`Error getting mod data.\n\`\`\`${err}\`\`\``);
            });
    }

    if (!modData) return replyMessage.edit('No mods found.');

    if (!message.channel.nsfw && modData.contains_adult_content) return replyMessage.edit(`${modData.name} contains adult content. Please mark this channel as NSFW to set up this feed.`)

    const confirmEmbed = new Discord.RichEmbed()
    .setAuthor(gameData ? gameData.name : modData.domain_name, `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${gameData.id}.jpg`)
    .setColor(0xda8e35)
    .setTitle(modData.name)
    .setDescription(modData.summary)
    .setThumbnail(modData.picture_url)
    .addField('Wrong Mod?', "Try again using the mod page URL or the exact title of the mod.")
    .addField("Confirm", `Updates for ${modData.name} (${gameData ? gameData.name : modData.domain_name}) will be posted in ${message.channel} periodically.\nThe API key for ${userData.name} (${message.author}) will be used.\nReact with ✅ to confirm or ❌ to cancel.`)
    .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);

    const confirmMsg = await replyMessage.edit(confirmEmbed).catch(console.error);

    const reactionFilter = (reaction, user) => (reaction.emoji.name === '✅' || reaction.emoji.name === '❌') && user.id === message.author.id
    var collector = confirmMsg.createReactionCollector(reactionFilter, {time: 15000, max: 1})
    confirmMsg.react('✅');
    confirmMsg.react('❌');

    collector.on('collect', async r => {
        //Cancel
        if (r.emoji.name === '❌') {
            confirmMsg.delete();
            return message.channel.send('Mod feed setup cancelled.');
        }
        //Confirm
        else if (r.emoji.name === '✅') {
            modFeed = {
                channel: message.channel.id,
                guild: message.guild.id,
                owner: message.author.id,
                domain: gameData ? gameData.name : modData.domain_name,
                mod_id: modData.mod_id,
                title: modData.name,
                last_status: modData.status,
            }
            
            try {
                const id = await createModFeed(modFeed);
                console.log(new Date() + ` - Mod feed created for ${modFeed.title} (${gameData ? gameData.name : modData.domain_name}) in ${message.channel.name} at ${message.guild.name} by ${message.author.tag} successfully. Reference #${id}`);
                confirmMsg.clearReactions();
                confirmMsg.edit("", {embed: feedSuccessEmbed(id, modFeed, modData, gameData, message)});
                return confirmMsg.pin().catch(() => undefined);
            }
            catch(err) {
                console.log(err);
                confirmMsg.clearReactions();
                return confirmMsg.edit(`Error creating modfeed. \`\`\`${err}\`\`\``, { embed: null });
            }

        }
        
      });
      collector.on('end', rc => {
        //End
        if (rc.size === 0) {
            confirmMsg.clearReactions();
            return confirmMsg.edit('Mod feed setup cancelled.', { embed: null });
        };
      });

}

const feedSuccessEmbed = (id, feed, modData, gameData, message) => {
    const embed = new Discord.RichEmbed()
    .setAuthor(`${modData.name} (${gameData ? gameData.name : modData.domain_name})`, (gameData ? `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${gameData.id}.jpg` : undefined), `https://www.nexusmods.com/${modData.domain_name}/mods/${modData.mod_id}`)
    .setColor(0xda8e35)
    .setDescription('Mod feed created successfully.')
    .setThumbnail(modData.picture_url)
    .setFooter(`Owner - ${message.author.tag} | ID: #${id}`,client.user.avatarURL)
    .setTimestamp(new Date());

    return embed;
}

const editEmbed = (feed, owner, message, client) => {
    const editEmbed = new Discord.RichEmbed()
        .setTitle('Editing Game Feed #'+feed._id)
        .setColor(0xda8e35)
        .setDescription(`Mod: ${feed.title}`+
        `\nChannel: ${client.channels.find(c => c.id === feed.channel) || 'Unknown channel'} in ${message.guild}`+
        `\nCreated by: ${owner ? owner.user.tag : '???'}`+
        `\nMessage: ${feed.messsage ? `"${feed.messsage}" - Update: 📬 | Remove: 📭.` : "Not set. Add: 📬"}`+
        `\n\nTo change the feed settings, use the reaction with the matching icon. ✅ confirms the changes, ❌ cancels the feed.`)
        .addField("🗄️ Show new files:", feed.show_files,true)
        .addField("🗒️ Show other:", feed.show_other,true)
        .setTimestamp(feed.created)
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);

    return editEmbed;
}