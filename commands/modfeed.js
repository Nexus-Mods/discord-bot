//THIS COMMAND IS A WORK IN PROGRESS.
const {linkedAccounts} = require('./link.js');
const Enmap = require("enmap");
const serverConfig = require('./../serverconfig.json') //For server specific settings.
const Discord = require("discord.js");
const nexusAPI = require('./../nexus-discord.js');
const modUpdates = new Enmap({
    name: "ModUpdates",
    autoFetch: true,
    fetchAll: true
  });

// module.exports.help = {
//     name: "modfeed",
//     description: "Creates a mod feed in this channel, periodically checking for updates for the chosen mod and posting if any are found.",
//     usage: "<mod name or url>",
//     moderatorOnly: true,
//     adminOnly: false  
// }

exports.run = async (client, message, args) => {
    //Abort for now
    return message.channel.send("This feature is coming soon.");
    
    //Not allowed in server/rolecheck
    if (!message.guild) return message.channel.send("This feature is not available in DMs.").catch(console.error);

    if (!message.member.hasPermissions("MANAGE_CHANNELS")) return message.channel.send("You do not have permission to use this feature.");

    //No args - explain feature, show subs for this channel.
    if (args.length === 0) {
        //EXPLAIN
        var tutorialEmbed = new Discord.RichEmbed()
        //.setAuthor()
        .setThumbnail(client.user.avatarURL)
        .setTitle("Set up a mod feed")
        .setDescription("Using this feature you can create a feed in this channel which will periodically report any new updates to a specified mod."+
        "\n\nTo set up the feed add the name or url of the game to the end of the command e.g. \"SkyUI\" or \"https://www.nexusmods.com/skyrimspecialedition/mods/12604\"."+
        "\n\nAdult content will only be included if the channel is marked NSFW in Discord."+
        "\n\n*The feed will use the API key linked to your account and can consume approximately 24 - 100 requests per day depending on your settings and the number of updates posted.*")
        .addField("Editing or cancelling feeds", "To edit an existing feed, added edit followed by a hash and the number reference of your feed e.g. !nexus modfeed edit #1.")
        .setColor(0xda8e35)
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)


        var channelSubs = await findAllSubs(gameUpdates, message.channel); //Pull all updates for this channel.
        if (channelSubs.length > 0) tutorialEmbed.addField("Mod Updates in this server", channelSubs.join("\n"));
        return message.channel.send(tutorialEmbed).catch(console.error);
    }

    //Find linked account
    var linkedUser = linkedAccounts.get(message.author.id);
    if (!linkedUser) return message.channel.send("Please link your Nexus Mods account to your Discord account before using this feature. See `!nexus link` help on linking your account.");

    //Find the mod domain and ID
    let gameDomain 
    let modID

    if (args[0].contains('https://')) {
        let urlObject = convertURL(args[0])
        gameDomain = urlObject.game
        modID = urlObject.ID
    }
    else {
        try {
            let searchResults = await nexusAPI.quicksearch(args.join(" "), true);
            if (searchResults.length > 0) {
                let foundResult = searchResults[0];
                gameDomain = foundResult.game_name;
                modID = foundResult.url.substring(result.url.lastIndexOf('/')+1,result.url.length);
            };

        }
        catch (err) {
            console.log(err);
        }
    };
    
    if (!gameDomain && !modID) return message.channel.send("No mod found for "+args.join(" "));

    //Grab mod info and confirm it's correct
    try {
        let modInfo = await nexusAPI.modInfo(message.author, gameDomain, modID);
        if (!modInfo.available) message.channel.send(`The mod you are search for is currently unavailable, please try again later. You may be able to see the reason for this by visiting the mod page. \nhttps://www.nexusmods.com/${gameDomain}/mods/${modID}`);

        let modUpdate = {
            channel: message.channel.id,
            guild: message.guild.id,
            user: message.author.id,
            game: gameDomain,
            //gameTitle: .name,
            modID: modID,
            settings: {
            },
            lastTimestamp: modInfo.updated_timestamp,
            created: Math.round((new Date()).getTime() / 1000)
        }

        if (modInfo.contains_adult_content && !message.channel.nsfw) return message.channel.send(`${modInfo.name} contains adult content and can only post a feed in a channel marked NSFW.`);

        //Save
        let updateEmbed = new Discord.RichEmbed()
        .setAuthor(message.author.tag, message.author.avatarURL)
        .setColor(0xda8e35)
        .setTitle(`Create mod feed in ${message.channel.name}?`)
        .setThumbnail(modInfo.image)
        .setDescription(`Updates for [${modInfo.name}](${`https://www.nexusmods.com/${gameDomain}/mods/${modID}`}) will be posted in ${message.channel} periodically. \n${modInfo.contains_adult_content ? `**This mod contains adult content.**` : `The mod is safe for work.`}\nThe API key for ${linkedUser.nexusName} will be used.`)
        .addField(`Options`, "React with ✅ to confirm or ❌ to cancel.")
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);

        let confirmMessage = await message.channel.send(updateEmbed);
        let reactionFilter = (reaction, user) => (reaction.emoji.name === '✅' || reaction.emoji.name === '❌') && user.id === message.author.id
        let collector = confirmMessage.createReactionCollector(reactionFilter, {time: 15000, max: 1})
        confirmMessage.react('✅');
        confirmMessage.react('❌');

        collector.on('collect', async r => {
            //Cancel
            if (r.emoji.name === '❌') return message.reply('Mod feed setup cancelled.')
            //Confirm
            var id = modUpdates.autonum
            await modUpdates.set(id, modUpdate);
            console.log(new Date() + ` - Registered game feed for ${modInfo.name} in ${message.channel.name} at ${message.guild.name} successfully. Reference #${id}`)
            return message.channel.send(`Registered game feed for ${modInfo.name} in ${message.channel} successfully. Reference #${id}`);
        });
        collector.on('end', rc => {
            //End
            confirmMsg.clearReactions();
            if (rc.size === 0) return message.reply('Mod feed setup cancelled.');
          });

    }
    catch (err) {
        message.channel.send(`An error occurred: ${err}`);
    };

};

const delay = 1000*60*60; //1 hour
let modUpdateTimer

modUpdates.defer.then(() => {
    client.on("ready", checkMods);
    modUpdateTimer = setInterval(checkMods, delay);
    console.log(`${new Date()} - Mod updates schedule every ${delay/60/1000} minutes.`)
});

async function checkMods() {
    if (modUpdates.count === 0) return
    console.log(`${new Date()} - Checking for updates across ${modUpdates.count} game feeds.`);
    modUpdates.forEach(async function (update) {
        //Get member data

        //Check API key

        //Check channel (including NSFW settings)

        //Pull mod info

        //Check for problems (mod deleted/not available) and compare to previously saved update.

        //Get files and changelogs?

        //build and post embed.

    });
}


async function findAllSubs(updateMap, channel) {
    //return an array of updates for the specified guild
    let results = []
    updateMap.forEach(async function(update) {
        var user = linkedAccounts.get(update.user) || client.users.find(u => u.id === update.user);
        if (update.guild === channel.guild.id) {
            var id = updateMap.findKey(u => u === update);
            //results.push(`**#${id}** - ${update.gameTitle} feed created by ${user.tag || user.nexusName} in ${client.channels.find(c => c.id === update.channel)}.\n🆕: ${update.settings.newMods} | ⏫: ${update.settings.updatedMods} | 🔞: ${update.settings.nsfw} | 🕹: ${update.settings.sfw} `)
        };
    });
    return results
}


async function convertURL(modLink) {
    let result
    modLink = modLink.replace("https://", "");
    modLink = modLink.replace("www.", "");
    modLink = modLink.replace("nexusmods.com/", "");
    modLink = modLink.replace("mods/", "");
    modLink = modLink.replace("?tab", "/");
    modLink = modLink.split("/");
    
    modLink = modLink.splice(0,2);
    let gameDomain = modLink[0];
    let modID = modLink[1];
    console.log(`gameName: ${gameDomain}, ID: ${modID}`);
    result = {game: gameDomain, ID: modID};

    return result
};