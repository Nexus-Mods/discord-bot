const link = require("./link.js");
const Discord = require('discord.js');
const serverConfig = require('./../serverconfig.json') //For server specific settings.

module.exports.help = {
    name: "ban",
    description: "Bans this user from the server. Where possible attach screenshot of ban reason. This will be posted in the logging channel. **Moderator only.**\n_[#posts] - How many days of posts to remove (optional)\n[reason] - Reason for the ban (required)_",
    usage: "[@user] [#posts] [reason]",
    moderatorOnly: true,
    adminOnly: false,
    officialOnly: true 
}

exports.run = async (client, message, args) => {
    //if DM return
    if (!message.guild) return
    
    //CHECK IF A NEXUS MODS OFFICIAL SERVER!!!!
    const serverSettings = serverConfig.find(s => s.id === message.guild.id);
    if (!serverSettings.official) return // doesn't work on non-Nexus Mods servers.
    var logChannel = serverSettings.nexusLogChannel ? message.guild.channels.find(c => c.id === serverSettings.nexusLogChannel) : undefined //where are we going to output the ban info?


    //check valid permissions
    if (!message.member.hasPermission("BAN_MEMBERS")) return message.delete() //message.reply("you cannot ban users in this server.")

    //find who we're getting rid of
    var userTag = args.join(" ").indexOf("#") ? args.join(" ").substring(0, args.join(" ").indexOf("#")+5) : args[0] //if tag has several words.
    var userTagged = client.users.find(u => u.tag.toLowerCase() === userTag.toLowerCase()) || undefined
    var memberToBanDiscord = message.mentions.members.first() || message.guild.members.find(m => m.displayName.toLowerCase() === args[0].toLowerCase()) || message.guild.members.find(m => m.id === args[0]) || userTagged && message.guild.members.find(m => m.id === userTagged.id)
    if (!memberToBanDiscord) return message.channel.send("No member found.");
    if (await message.guild.fetchBans().then(bans => bans.get(memberToBanDiscord.id))) return message.reply(args[0]+" is already banned from this server.")
    
    //console.log(memberToBanDiscord.user.tag)

    //Did we find the member?
    if (!memberToBanDiscord) return message.reply("you did not tag a user to ban. For help try `!NM help ban`.")

    //Can we ban this member?
    if (!memberToBanDiscord.bannable || memberToBanDiscord === client.user) return message.reply("you cannot ban "+memberToBanDiscord)
    
    //Collect moderator data and user data
    const linkedAccounts = link.linkedAccounts
    var memberToBanNexus = linkedAccounts.get(memberToBanDiscord.id)
    var moderator = message.author

    //Trim off the first arguement as this is the member we want gone. 
    args.shift()

    //Did we pass the number of days to delete posts? Grab that number and trim it off the reason. 
    var postDeleteDays = isNaN(args[0]) || args[0] === 0 ? 0 : args[0];
    if (postDeleteDays > 0 || args[0] === 0) args.shift()

    //What remains is our ban reason. Grab any attachments to use as evidence.
    var banReason = args.join(" ")
    var banEvidence = message.attachments.map(messageAttachment => messageAttachment.proxyURL)

    var banLogMessage
    if (logChannel) {
        var banLoggingEmbed = new Discord.RichEmbed()
        .setColor(16711680)
        .setAuthor(moderator.username, moderator.avatarURL)
        .setThumbnail(memberToBanDiscord.user.avatarURL)
        .setTitle(`${memberToBanDiscord.user.tag} banned`)
        .setDescription(`${memberToBanDiscord.user} has been banned from this server by ${moderator.tag}`)
        .addField("Reason", banReason)
        .setTimestamp(new Date())
        .setFooter("Nexus Mods Moderation Team",message.guild.iconURL)
        //If we removed their posts.
        if (postDeleteDays > 0) banLoggingEmbed.addField("Posts Deleted", `Any posts by this user for the last ${postDeleteDays} days have been removed.`,true)
        //Add any supplied images
        if (banEvidence.length) {
            banLoggingEmbed.addField("Related files:", banEvidence.join("\n"))
            .setImage(banEvidence[0])
        }
        //Report their Nexus Mods account, if it exists.
        if (memberToBanNexus) banLoggingEmbed.addField("Nexus Mods Profile",`[${memberToBanNexus.nexusName}](https://www.nexusmods.com/users/${memberToBanNexus.nexusID})`)
        //Print into the server log. 
        banLogMessage = await logChannel.send(banLoggingEmbed).catch(console.error)
    }

    //Attempt to inform the user why they were banned. 
    var banUserMessage = new Discord.RichEmbed()
    .setColor(16711680)
    .setAuthor("Nexus Mods Moderation Team", client.user.avatarURL)
    .setThumbnail(message.guild.iconURL)
    .setTitle(`You have been banned from the ${message.guild.name} Discord server!`)
    .setDescription(`**Reason:** \n${banReason}`)
    .addField("Terms of Service", "You can review our [Terms of Service](https://help.nexusmods.com/category/10-policies-and-guidelines) here.")
    .addField("Can I appeal a ban?","We allow all banned users a single appeal. This will be reviewed by our staff who will decide if you can rejoin the server. \n [More Information](https://help.nexusmods.com/article/33-what-can-i-do-if-my-account-has-been-banned) ")
    .setFooter("No action has been taken against your Nexus Mods account at this time.") 
    try {
        memberToBanDiscord.send(banUserMessage)        
    }
    catch (err) {
        console.log(err)
        if (logChannel) logChannel.send(`${memberToBanDiscord} does not accept DMs so I have been unable to inform them of the ban reason.`)
    }

    //Record the last channel they posted in and actually do the banning.
    var lastPostChannel = memberToBanDiscord.lastMessage ? memberToBanDiscord.lastMessage.channel : message.channel
    var channelNotice = new Discord.RichEmbed()
    //.setTitle(`${memberToBanDiscord.user.tag} has been banned from this server`)
    .setColor(16711680)
    .setDescription(`${memberToBanDiscord.user} (${memberToBanDiscord.user.tag}) has been banned from this server${banLogMessage ? ` - [Staff Reference](${banLogMessage.url}` : ""})`)

    if (lastPostChannel !== message.channel) lastPostChannel.send(channelNotice).catch(console.error)
    message.channel.send(channelNotice).catch(console.error)

    memberToBanDiscord.ban({days: postDeleteDays, reason: banReason}).then(() => console.log(`${memberToBanDiscord.user.tag} banned by ${moderator.tag}`)).catch(console.error);
};