const Discord = require('discord.js');
const link = require('./link.js');
const serverConfig = require('./../serverconfig.json') //For server specific settings.

module.exports.help = {
    name: "removemod",
    description: "Allows authors to remove mods on their profile cards in Discord.",
    usage: "[full mod title]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

exports.run = async (client, message, args) => {
    const serverSettings = message.guild ? serverConfig.find(s => s.id === message.guild.id) : undefined;
    var replyChannel = serverSettings && serverSettings.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel 

    //No arguements passed. Explain the feature.
    if (args.length === 0) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""}To unlink a mod from your Discord account, type \`!nexus removemymod <full mod title>\`.`).catch(console.error)
    
    const linkedAccounts = link.linkedAccounts;
    var userData = linkedAccounts.has(message.author.id) ? linkedAccounts.get(message.author.id) : undefined

    //No linked account.
    if (!userData) return replyChannel.send(message.author+" please link your Nexus Mods and Discord accounts before adding mods. See `!nexus help link` for more information.").catch(console.error)

    var modtoRemove = userData.mods && userData.mods.find(m => m.name.toLowerCase() === args.join(" ").toLowerCase());

    //Not found
    if (!modtoRemove) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""}There are no mods called "${args.join(" ")}" linked to your account.  Please ensure the spelling matches the mod title, including symbols or special characters.`).catch(console.error)

    //Remove the mod from the profile
    console.log(`${new Date()} - Removing ${modtoRemove.name} from ${userData.nexusName}`);
    userData.nexusModDownloadTotal -= modtoRemove.downloads;
    userData.mods.splice(userData.mods.findIndex(mod => mod === modtoRemove),1);
    //console.log(userData.mods)

    //resave user data. 
    userData.lastupdate = new Date();
    linkedAccounts.set(`${message.author.id}`, userData);
    replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : ""}Unlinked ${modtoRemove.name} from your account successfully.`).catch(console.error);

}
