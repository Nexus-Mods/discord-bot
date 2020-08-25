//FUTURE DEVELOPMENT: Explore using Guild.fetchAuditLogs to retrieve the ban record. 
const Discord = require('discord.js');

module.exports.help = {
    name: "unban",
    description: "Revokes the ban for the user. Can also be done in the server control panel. **Moderator only.**\n_[@user] - Discord ID/Tag (required)\n[reason] - Reason for the unban (required)_",
    usage: "[@user] [reason]",
    moderatorOnly: true,
    adminOnly: false,
    officialOnly: true   
}

exports.run = async (client, message, args, serverSettings) => {
    //if a DM return 
    if (!message.guild) return

    //Check if this is an official server.
    if (!serverSettings || !serverSettings.official) return // doesn't work on non-Nexus Mods servers.
    var logChannel = serverSettings.logging ? message.guild.channels.find(c => c.id === serverSettings.logChannel) : undefined //where are we going to output the ban info?

    //if not a moderator
    if (!message.member.hasPermission("BAN_MEMBERS")) return

    //If invalid arguments
    if (args.length < 2) return message.reply("please specify a Discord ID to unban and a reason.");

    //get user to unban and check if they're banned.
    var allBans = await message.guild.fetchBans(true)
    var userTag = args.join(" ").indexOf("#") ? args.join(" ").substring(0, args.join(" ").indexOf("#")+5) : args[0]
    if (args.length < 2 || args.join(" ").length <= userTag.length) return message.reply("please specify a Discord ID to unban and a reason.");
    console.log(userTag)
    var userToCheck = client.users.find(u => u.tag.toLowerCase() === userTag.toLowerCase()) || client.users.find(u => u.id.toLowerCase() === args[0].toLowerCase()) || client.users.find(u => u.username.toLowerCase() === args[0].toLowerCase()) || undefined
    if (!userToCheck || !allBans.get(userToCheck.id)) return message.channel.send("Not found.") //not found error
    var banData = allBans.get(userToCheck.id)
    var unBanReason = args.join(" ").substring(args.join(" ").indexOf(userTag) + userTag.length, args.join(" ").length)
    //banData.user is the user, banData.reason is the reason. 

    var unBanEmbed = new Discord.RichEmbed()
    .setAuthor(message.author.username, message.author.avatarURL)
    .setColor(3447003)
    .setTitle(`${userToCheck.tag} unbanned`)
    .setThumbnail(userToCheck.avatarURL)
    .setDescription(`${userToCheck} has been unbanned from this server by ${message.author.tag}`)
    .addField("Unban Reason", unBanReason)
    .addField("Original Ban Reason", banData.unBanReason)
    .setTimestamp(new Date())
    .setFooter("Nexus Mods Moderation Team",message.guild.iconURL)
    
    console.log(`${userToCheck.tag} was unbanned from ${message.guild} by ${message.author.tag}`)
    if (!logChannel) return
    logChannel.send(unBanEmbed).catch(console.error)
    message.channel.send(userToCheck.tag+" unbanned from the server.")
    message.guild.unban(userToCheck,reason).catch(console.error)
    userToCheck.send(`You have been unbanned from ${message.guild}`).catch(console.log("Could not notify user they have been unbanned."))
};