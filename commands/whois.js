const link = require('./link.js');
const Discord = require('discord.js');
const serverConfig = require("../serverconfig.json");

module.exports.help = {
    name: "whois",
    description: "A lookup feature which will tell you if a user has their Nexus Mods account linked to Discord and vice-versa.\n_[query] - Discord user (ping) or Nexus Mods username._",
    usage: "[query]",
    moderatorOnly: false,
    adminOnly: false  
}


exports.run = async (client, message, args) => {
        if (!message.guild) return //Whois can only be used in a guild.
        const linkedAccounts = link.linkedAccounts
        const serverSettings = serverConfig.find(s => s.id === message.guild.id);
        var replyChannel = serverSettings.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel

        if (!linkedAccounts.get(message.author.id)) return replyChannel.send((replyChannel !== message.channel ? message.author+" " : " ")+"Please link your Nexus Mods account to use this feature. See `!nexus link` for more.")
        if (args.length === 0) return replyChannel.send((replyChannel !== message.channel ? message.author+" " : " ")+"Please specify a Discord account or Nexus Mods username to look up."); //Error for empty search query.

        var userTag = args.join(" ").indexOf("#") ? args.join(" ").substring(0, args.join(" ").indexOf("#")+5) : args[0] //if tag has several words.
        var taggedMember = await client.users.find(u => u.tag.toLowerCase() === userTag.toLowerCase())
        var discordMember = await message.mentions.members.first() || message.guild.members.find(m => m.id === args[0]) || taggedMember && message.guild.members.find(m => m.id === taggedMember.id) || message.guild.members.find(m => m.displayName.toLowerCase() === args[0].toLowerCase())
        var nexusUser = discordMember ? linkedAccounts.get(discordMember.id) : linkedAccounts.find(m => m.nexusName.toLowerCase() === args.join(" ").toLowerCase())
        if(!discordMember) discordMember = message.guild.members.has(linkedAccounts.findKey(val => val === nexusUser)) ? message.guild.members.get(linkedAccounts.findKey(val => val === nexusUser)) : undefined

        console.log(`Whois lookup - Nexus: ${nexusUser ? nexusUser.nexusName : "Not found"}, Discord: ${discordMember ? discordMember.user.tag: "Not found"}`);

        if (discordMember && discordMember.user === client.user) return replyChannel.send((replyChannel !== message.channel ? message.author+" " : " ")+"That's me!");

        if (!discordMember && nexusUser && client.users.has(linkedAccounts.findKey(val => val === nexusUser))) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : " "}There are no users in this server linked to "${nexusUser.nexusName}".`)
        if (!discordMember || !nexusUser) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : " "}There doesn't seem to be a ${discordMember ? "Nexus Mods" : "Discord"} account linked to ${discordMember ? discordMember.user.tag : `"${args.join(" ")}"`} at the moment.`);

        //If the users is unlinked in this server
        if (!nexusUser.serversLinked.find(s => s === message.guild.id)) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : " "}There are no users in this server linked to "${nexusUser.nexusName}".`)

        var memberProfileEmbed = new Discord.RichEmbed()
        .setAuthor(`Member Search Results`, discordMember.user.avatarURL)
        .addField("Nexus Mods", `[${nexusUser.nexusName}](https://www.nexusmods.com/users/${nexusUser.nexusID})\n${(nexusUser.nexusPremium ? "Premium Member" : nexusUser.nexusSupporter ? "Supporter" : "Member")}`, true)
        .addField("Discord", `${discordMember}\n${discordMember.user.tag}`,true)
        .setColor(0xda8e35)
        .setThumbnail(nexusUser.avatarURL ? nexusUser.avatarURL : client.user.avatarURL)
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)
        if (nexusUser.mods && nexusUser.mods.length > 0) {
            var modList = []
            for (i = 0; i < (nexusUser.mods.length > 5 ? 5 : nexusUser.mods.length); i++) {
                var mod = nexusUser.mods[i]
                //{name: ownedMod.name, downloads: ownedMod.downloads,game: ownedMod.game_name,modid:(ownedMod.url.substring(ownedMod.url.lastIndexOf('/')+1,ownedMod.url.length)), url: "https://www.nexusmods.com"+ownedMod.url}
                modList.push(`[${mod.name}](${mod.url}) - ${mod.game}`)
            }
            memberProfileEmbed.addField(`Mods by ${nexusUser.nexusName} - ${nexusUser.nexusModDownloadTotal.toLocaleString()} total downloads at last check.`, `${modList.join("\n")}\n-----\n[**See all of ${nexusUser.nexusName}'s content at Nexus Mods.**](https://www.nexusmods.com/users/${nexusUser.nexusID}?tab=user+files)`)
        } 
        
        if (nexusUser.serversLinked.length > 0) {
            var serverList = []
            for (i = 0; i < nexusUser.serversLinked.length; i++) {
                //list servers if they still exist.
                try {
                    serverList.push(client.guilds.find(s => s.id === nexusUser.serversLinked[i]).name)
                }
                catch (err) {
                    console.log(`Removing missing server ${nexusUser.serversLinked[i]}`)
                    nexusUser.serversLinked.splice(i)
                }
            }
            memberProfileEmbed.addField(`Nexus Mods account connected in ${nexusUser.serversLinked.length} servers`, serverList.join(", "))
        }

        if (replyChannel !== message.channel) message.delete().catch(console.error)
        return replyChannel.send((replyChannel !== message.channel ? message.author : ""),memberProfileEmbed).catch(console.error);
        

    };