const { getUserByDiscordId } = require("../api/bot-db.js");
const Discord = require('discord.js');

module.exports.help = {
    name: "ban",
    description: "Bans this user from the server. Where possible attach screenshot of ban reason. This will be posted in the logging channel. **Moderator only.**\n_[#posts] - How many days of posts to remove (optional)\n[reason] - Reason for the ban (required)_",
    usage: "[@user] [#posts] [reason]",
    moderatorOnly: true,
    adminOnly: false,
    officialOnly: true 
}

exports.run = async (client, message, args, serverData) => {
    //if DM return
    if (!message.guild) return
    
    //CHECK IF A NEXUS MODS OFFICIAL SERVER!!!!
    if (!serverData.official) return // doesn't work on non-Nexus Mods servers.
    const logChannel = serverData.channel_nexus ? message.guild.channels.find(c => c.id === serverData.channel_nexus) : undefined; //where are we going to output the ban info?


    //check valid permissions
    if (!message.member.hasPermission("BAN_MEMBERS")) return message.delete(); //message.reply("you cannot ban users in this server.")
    if (!message.guild.me.hasPermission("BAN_MEMBERS")) return message.channel.send(`I do not have permission to ban users in this server.`);

    //If no args supplied
    if (!args || !args.length) {
        
        message.author.send(`Ban failed in ${message.channel} (${message.guild}). Please specify a user to ban in the following format and attach a screenshot if required. \n \`!nexus ban {discordping} {?number of posts to remove (days)} {reason}\``).catch(() => undefined);
        return message.delete().catch(() => undefined);
    };

    //find who we're getting rid of
    const userTag = args.join(" ").indexOf("#") ? args.join(" ").substring(0, args.join(" ").indexOf("#")+5) : args[0] //if tag has several words.
    const userTagged = client.users.find(u => u.tag.toLowerCase() === userTag.toLowerCase()) || undefined
    const memberToBanDiscord = message.mentions.members.first() || message.guild.members.find(m => m.displayName.toLowerCase() === args[0].toLowerCase()) || message.guild.members.find(m => m.id === args[0]) || userTagged && message.guild.members.find(m => m.id === userTagged.id)
    if (!memberToBanDiscord) return message.channel.send("No member found.");
    if (await message.guild.fetchBans().then(bans => bans.get(memberToBanDiscord.id))) return message.reply(args[0]+" is already banned from this server.");
    
    // Cant ban yourself.
    if (memberToBanDiscord === message.member) return message.reply(`You cannot ban yourself. That would be silly!`).catch(() => undefined);

    //Did we find the member?
    if (!memberToBanDiscord) return message.reply("you did not tag a user to ban. For help try `!NM help ban`.").catch(() => undefined);

    //Can we ban this member?
    if (!memberToBanDiscord.bannable || memberToBanDiscord === client.user) return message.author.send(`You cannot ban ${memberToBanDiscord} from ${message.guild}.`).catch(() => undefined); message.delete().catch(() => undefined);
    
    //Collect moderator data and user data
    const memberToBanNexus = await getUserByDiscordId(memberToBanDiscord.id);
    const moderator = message.author;

    //Trim off the first arguement as this is the member we want gone. 
    args.shift();

    //Did we pass the number of days to delete posts? Grab that number and trim it off the reason. 
    const postDeleteDays = isNaN(args[0]) || args[0] === 0 ? 0 : args[0];
    if (postDeleteDays > 0 || args[0] === 0) args.shift();

    //What remains is our ban reason. Grab any attachments to use as evidence.
    let banReason = args.join(" ");
    if (!banReason || !banReason.length) banReason = `Breaching the Nexus Mods ToS.`
    const banEvidence = message.attachments.map(messageAttachment => messageAttachment.proxyURL);

    let banLogMessage
    if (logChannel) {
        const banLoggingEmbed = new Discord.RichEmbed()
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
        if (memberToBanNexus) banLoggingEmbed.addField("Nexus Mods Profile",`[${memberToBanNexus.name}](https://www.nexusmods.com/users/${memberToBanNexus.id})`)
        //Print into the server log. 
        banLogMessage = await logChannel.send(banLoggingEmbed).catch(console.error)
    }

    //Attempt to inform the user why they were banned. 
    const banUserMessage = new Discord.RichEmbed()
    .setColor(16711680)
    .setAuthor("Nexus Mods Moderation Team", client.user.avatarURL)
    .setThumbnail(message.guild.iconURL)
    .setTitle(`You have been banned from the ${message.guild.name} Discord server!`)
    .setDescription(`**Reason:** \n${banReason}`)
    .addField("Terms of Service", "You can review our [Terms of Service](https://help.nexusmods.com/category/10-policies-and-guidelines) here.")
    .addField("Can I appeal a ban?","We allow all banned users a single appeal. This will be reviewed by our staff who will decide if you can rejoin the server. \n [More Information](https://help.nexusmods.com/article/33-what-can-i-do-if-my-account-has-been-banned) ")
    .setFooter("No action has been taken against your Nexus Mods account at this time.") 
    
    // Inform the user of the ban, if we can.
    memberToBanDiscord.send(banUserMessage)   
        .catch(() => {  
            if (logChannel) logChannel.send(`${memberToBanDiscord.user.tag} does not accept DMs so I have been unable to inform them of the ban reason.`);
        });

    //Record the last channel they posted in and actually do the banning.
    const lastPostChannel = memberToBanDiscord.lastMessage ? memberToBanDiscord.lastMessage.channel : message.channel
    const channelNotice = new Discord.RichEmbed()
    .setColor(16711680)
    .setDescription(`${memberToBanDiscord.user} (${memberToBanDiscord.user.tag}) has been banned from this server${banLogMessage ? ` - [Staff Reference](${banLogMessage.url}` : ""})`)

    if (lastPostChannel !== message.channel && lastPostChannel !== logChannel) lastPostChannel.send(channelNotice).catch(console.error);
    message.channel.send(channelNotice).catch(console.error);

    if (memberToBanDiscord === client.user || memberToBanDiscord.user.bot) return;
    memberToBanDiscord.ban({days: postDeleteDays, reason: banReason})
        .then(() => console.log(`${memberToBanDiscord.user.tag} banned by ${moderator.tag}`))
        .catch(console.error);
};