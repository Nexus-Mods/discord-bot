// const {linkedAccounts} = require('./link.js');
// const Enmap = require("enmap");
const { getUserByDiscordId } = require('../api/users.js');
const { createGameFeed, deleteGameFeed, getGameFeedsForServer, getGameFeed, updateGameFeed } = require('../api/game_feeds.js');
const Discord = require("discord.js");
const nexusAPI = require('../api/nexus-discord.js');
// const gameUpdates = new Enmap({
//     name: "GameUpdates",
//     autoFetch: true,
//     fetchAll: true
//   });

//gameUpdates.defer.then(() => gameUpdates.deleteAll()); //wipe the database.

module.exports.help = {
    name: "gamefeed",
    description: "Creates a game feed in this channel, publishing new or updated mods every 10 minutes.",
    usage: "<game> <?NSFW/SFW flag>",
    moderatorOnly: true,
    adminOnly: false  
}


exports.run = async (client, message, args) => {
    //Not allowed in server/rolecheck
    if (!message.guild) return message.channel.send("This feature is not available in DMs.").catch(console.error);

    if (!message.member.hasPermission("MANAGE_CHANNELS")) return message.channel.send("You do not have permission to use this feature.");

    
    //No args - explain feature, show subs for this channel.
    if (args.length === 0) {
        //EXPLAIN
        var tutorialEmbed = new Discord.RichEmbed()
        //.setAuthor()
        .setThumbnail(client.user.avatarURL)
        .setTitle("Set up a game feed")
        .setDescription("Using this feature you can create a feed in this channel which will periodically report new and updated mods posted for a specfied game."+
        "\n\nTo set up the feed add the name or domain of the game to the end of the command e.g. \"Stardew Valley\" or \"stardewvalley\"."+
        "\n\nBy default adult content will only be included if the channel is marked NSFW in Discord, but this can be changed by adding `-NSFW` after the game name."+
        "\n\n*The feed will use the API key linked to your account and can consume approximately 144 - 1500 requests per day depending on your settings and the number of mods posted.*")
        .addField("Editing or cancelling feeds", "To edit an existing feed, added edit followed by a hash and the number reference of your feed e.g. !nexus gamefeed edit #1.")
        .setColor(0xda8e35)
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)


        // var channelSubs = await findAllSubs(gameUpdates, message.channel); //Pull all updates for this channel.
        const serverFeeds = async (guild) => {
            const feeds = await getGameFeedsForServer(guild.id);
            if (!feeds.length) return undefined;
            return feeds.map(feed => {
                const user = guild.members.find(m => m.id === feed.owner);
                return `**#${feed._id}** - ${feed.title} feed created by ${user || '*Unknown user*'} in <#${feed.channel}>.\n🆕: ${feed.show_new} | ⏫: ${feed.show_updates} | 🔞: ${feed.nsfw} | 🕹: ${feed.sfw}`
            })
        } 
        const feedMap = await serverFeeds(message.guild);
        if (feedMap) tutorialEmbed.addField("Game Updates in this channel", feedMap.join("\n"));
        return message.channel.send(tutorialEmbed).catch(console.error);
    }

    //Find linked account
    const userData = await getUserByDiscordId(message.author.id);
    if (!userData) return message.channel.send("Please link your Nexus Mods account to your Discord account before using this feature. See `!nexus link` help on linking your account.")


    //CHECK FOR EDITING OPTION. !nexus gamefeed edit #{id}
    if (args[0].toLowerCase() === 'edit' && args[1].indexOf('#') === 0) {
        const feedID = args[1].substring(1);
        if (isNaN(feedID)) return message.channel.send("Invalid feed ID: "+args[1]);
        const feedObject = await getGameFeed(feedID);
        if (!feedObject) return message.channel.send("Could not find a feed with ID: "+feedID);
        const owner = message.guild.members.find(m => m.id === feedObject.owner);
        if (message.author !== owner && !message.member.hasPermission("MANAGE_CHANNELS")) return message.channel.send("You do not have permission to edit this feed.");
        if (feedObject.guild !== message.guild.id) return message.channel.send(`Cannot managed feed #${feedID} as it is not set up in this server.`);
        var editEmbed = new Discord.RichEmbed()
        .setTitle('Editing Game Feed #'+feedID)
        .setColor(0xda8e35)
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)
        .setDescription(`Game: ${feedObject.gameTitle}`+
        `\nChannel: ${client.channels.find(c => c.id === feedObject.channel) || 'Unknown channel'} in ${message.guild}`+
        `\nCreated by: ${owner ? owner.tag : '???'}`+
        `\nMessage: ${feedObject.announceMsg ? `"${feedObject.announceMsg}" - Update: 📬 | Remove: 📭.` : "Not set. Add: 📬"}`+
        `\n\nTo change the feed settings, use the reaction with the matching icon. ✅ confirms the changes, ❌ cancels the feed.`)
        .setTimestamp(feedObject.created)
        .addField("🆕 Show new:", feedObject.show_new,true)
        .addField("⏫ Show updates:", feedObject.show_updates,true)
        .addField("🔞 Adult Content:", feedObject.nsfw,true)
        .addField("🕹 Safe Content:", feedObject.sfw,true)

        const editMessage = await message.channel.send(editEmbed).catch(console.error);
        //Check for the 4 toggles
        const toggles = ["✅", "❌", "🆕", "⏫", "🔞", "🕹","📬","📭"];
        const reactionFilter = (reaction, user) => user.id === message.author.id && toggles.indexOf(reaction.emoji.name) !== -1;
        const editCollector = editMessage.createReactionCollector(reactionFilter, {time: 30000, max: 4});
        toggles.forEach(emoji => editMessage.react(emoji));

        let newData = {};

        editCollector.on('collect', async r => {
            if (r.emoji.name === '✅') {
                editMessage.clearReactions();
                editCollector.stop("Stopped by user.");
            };
            if (r.emoji.name === '🆕') {
                newData.show_new = !feedObject.show_new
                message.channel.send(`New mod uploads ${newData.show_new ? "will" : "will **not**" } be included.`).catch(console.error);
            };
            if (r.emoji.name === '⏫') {
                newData.show_updates = !feedObject.show_updates
                message.channel.send(`Updated mods ${feedObject.show_updates ? "will" : "will **not**" } be included.`).catch(console.error);
            };
            if (r.emoji.name === '🔞') {
                newData.nsfw = !feedObject.nsfw;
                message.channel.send(`Adult content ${newData.nsfw ? "will" : "will **not**" } be included. ${message.channel.nsfw ? "" : "\n*Note: We recommend you set this channel to NSFW if you wish to showcase adult content.*"}`).catch(console.error);
            };
            if (r.emoji.name === '🕹') {
                newData.sfw = !feedObject.sfw;
                message.channel.send(`Safe for work content ${newData.sfw ? "will" : "will **not**" } be included.`).catch(console.error);
            };
            if (r.emoji.name === '❌') {
                editCollector.stop("Deleted by user.");
            };
            if (r.emoji.name === '📬') {
                //Collect a new notification message.
                await message.channel.send("Type the message you would like to send when new mods are available.");
                var newMsgCollector = await message.channel.createMessageCollector(m => m.author === message.author, {maxMatches: 1, time: 15000});
                newMsgCollector.on('collect', m => {
                    newData.message = m.content;
                    message.channel.send(`Before each feed update the following message will be sent: "${m.content}"`);
                });
                newMsgCollector.on('end', mc => {
                    if (mc.size === 0) message.channel.send("No new message was set.")
                })

            };
            if (r.emoji.name === '📭' && feedObject.announceMsg) {
                newData.message = null;
                message.channel.send("Update message cleared.") 
            };
        });
        editCollector.on('end', rc => {
            if (rc.find(r => r.emoji.name === '❌')) {
                //delete the feed
                editMessage.clearReactions();
                return deleteGameFeed(feedObject._id)
                .then(() => {
                    message.channel.send("Game feed was deleted.");
                    console.log(new Date() + ` - Game feed #${feedObject._id} for ${feedObject.title} in ${message.channel.name} at ${message.guild.name} deleted by ${rc.first().users.last().tag}`);
                })
                .catch(err => message.channel.send("Error deleting game feed."+err));
            }
            else {
                //save the changes
                editMessage.clearReactions();
                return updateGameFeed(feedObject._id, newData)
                .then(() => {
                    message.channel.send("Game feed saved successfully.")
                    console.log(new Date() + ` - Game feed #${feedObject._id} for ${feedObject.title} in ${message.channel.name} at ${message.guild.name} edited by ${message.author.tag}`);
                })
                .catch(err => message.channel.send("Error saving game feed."+err));
            }

        });
        return


    }

    //NSFW setting
    var allowAdultContent = false
    if (args.includes("-NSFW") || args.includes("-SFW")) {
        if (args.includes("-NSFW")) {
            //Manually mark NSFW, remove arg
            allowAdultContent = true;
            args.splice(args.indexOf("-NSFW"),1);
        }
        else {
            //Manually mark NSFW, remove arg
            allowAdultContent = false;
            args.splice(args.indexOf("-SFW"),1);
        }
    }
    else {
        allowAdultContent = message.channel.nsfw
    }

    //Find game
    var gameQuery = args.join(" ");
    try {
        var gameList = await nexusAPI.games(userData);
        var gameToSubscribe = gameList.find(g => g.name.toLowerCase() === gameQuery.toLowerCase()) || gameList.find(g => g.domain_name.toLowerCase() === gameQuery.toLowerCase()) || undefined
        if (!gameToSubscribe) return message.channel.send(`Could not find a game for your query: ${gameQuery}. Please ensure the name exactly matches the name as it appears on the Nexus Mods website **or** the name used in the web address (e.g. skyrimspecialedition).`).catch(console.error);
    }
    catch(err) {
        return message.channel.send("Error in game lookup", err.stack).catch(console.error);
    }

    //Confirm settings and save
    var confirmEmbed = new Discord.RichEmbed()
    .setAuthor(message.author.tag, message.author.avatarURL)
    .setColor(0xda8e35)
    .setTitle(`Create feed in ${message.channel.name}?`)
    .setThumbnail(`https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${gameToSubscribe.id}.jpg`)
    .setDescription(`New and updated mods for ${gameToSubscribe.name} will be posted in ${message.channel} periodically. \nAdult content ${allowAdultContent ? "will" : "will not"} be included.\nThe API key for ${userData.name} will be used.`)
    .addField(`Options`, "React with ✅ to confirm or ❌ to cancel.")
    .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);
    var confirmMsg = await message.channel.send(confirmEmbed).catch(console.error);
    var reactionFilter = (reaction, user) => (reaction.emoji.name === '✅' || reaction.emoji.name === '❌') && user.id === message.author.id
    var collector = confirmMsg.createReactionCollector(reactionFilter, {time: 15000, max: 1})
    confirmMsg.react('✅');
    confirmMsg.react('❌');

    collector.on('collect', async r => {
        //Cancel
        if (r.emoji.name === '❌') return message.reply('Game feed setup cancelled.')
        //Confirm
        var gameHook = await message.guild.fetchWebhooks().then(wh => wh.find(wb => wb.channelID === message.channel.id && wb.name === "Nexus Mods Game Feed"));        
        if (!gameHook) gameHook = message.channel.createWebhook("Nexus Mods Game Feed", client.user.avatarURL,"Game Feed").catch(console.error);
        var wb_id = gameHook ? gameHook.id : undefined; 
        var wb_token = gameHook ? gameHook.token: undefined;
        
        
        gameUpdate = {
            channel: message.channel.id,
            guild: message.guild.id,
            owner: message.author.id,
            domain: gameToSubscribe.domain_name,
            title: gameToSubscribe.name,
            nsfw: allowAdultContent,
            sfw: true,
            show_new: true,
            show_updates: true,
            webhook_id: wb_id,
            webhook_token: wb_token
        };
        console.log(`new Update`, gameUpdate);
        //if (client.guild.me.hasPermission("MANAGE_WEBHOOKS"))
        // var id = gameUpdates.autonum
        // await gameUpdates.set(id, gameUpdate);
        try {
            const id = await createGameFeed(gameUpdate);
            console.log(new Date() + ` - Game feed created for ${gameToSubscribe.name} in ${message.channel.name} at ${message.guild.name} by ${message.author.tag} successfully. Reference #${id}`);
            return message.channel.send(`Registered game feed for ${gameToSubscribe.name} in ${message.channel} successfully. Reference #${id}`);
        }
        catch(err) { 
            console.log(err);
            return message.channel.send(`Error creating gamefeed. \`\`\`${err}\`\`\``);
        };
        
      });
      collector.on('end', rc => {
        //End
        confirmMsg.clearReactions();
        if (rc.size === 0) return message.reply('Game feed setup cancelled.');
      });

};

const delay = 1000*60*10; //10mins
let gameUpdateTimer

// gameUpdates.defer.then(() => {
//     gameUpdateTimer = setInterval(checkGames, delay);
//     console.log(`${new Date()} - Game updates scheduled every ${delay/60/1000} minutes.`);
//     client.on("ready", checkGames);
// });

async function findAllSubs(updateMap, channel) {
    //return an array of updates for the specified channel
    results = []
    updateMap.forEach(async function(update) {
        var user = linkedAccounts.get(update.user) || client.users.find(u => u.id === update.user);
        if (update.guild === channel.guild.id) {
            var id = updateMap.findKey(u => u === update);
            results.push(`**#${id}** - ${update.gameTitle} feed created by ${user.tag || user.nexusName} in ${client.channels.find(c => c.id === update.channel)}.\n🆕: ${update.settings.newMods} | ⏫: ${update.settings.updatedMods} | 🔞: ${update.settings.nsfw} | 🕹: ${update.settings.sfw} `)
        };
    });
    return results
}
