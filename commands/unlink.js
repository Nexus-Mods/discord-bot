const Enmap = require("enmap");
const link = require("./link.js");
const serverConfig = require('./../serverconfig.json'); //For server specific settings.
const Discord = require("discord.js");
const config = require('../config.json');

module.exports.help = {
    name: "unlink",
    description: "Removes the link between your Discord account and Nexus Mods account in this server. \n*Send to the bot in a Direct Message to unlink all.*",
    usage: "",
    moderatorOnly: false,
    adminOnly: false 
}

exports.run = async (client,message,args) => {
    const linkedAccounts = link.linkedAccounts
    
    //Nexus Mods staff actions - can forcefully delete a user's account was "!nm unlink force {username}"
    if (!message.guild && args[0] == "force" && config.ownerID.find(m => m === message.author.id)) {
        if (linkedAccounts.find(u => u.nexusName.toLowerCase() === args[1].toLowerCase())) {
            var nexusLink = linkedAccounts.find(u => u.nexusName.toLowerCase() === args[1].toLowerCase());
            var discordUser = client.users.find(u => u.id === nexusLink.id);
            if (discordUser) discordUser.send("Your Nexus Mods account has been unlinked from your Discord account by the Nexus Mods staff.").catch(console.error);
            message.reply("Deleted "+nexusLink.nexusName);
            return linkedAccounts.delete(nexusLink.id);
        }
    }

    //Moderator actions
    if (message.guild && message.member.hasPermission("MANAGE_ROLES")) {
        //Do moderator only stuff
        if (linkedAccounts.find(u => u.nexusName.toLowerCase() === args[0].toLowerCase())) {
            var nexusLink = linkedAccounts.find(u => u.nexusName.toLowerCase() === args[0].toLowerCase());
            return console.log('Found '+nexusLink.nexusName);
        }
    }

    //Where should I reply?
    const serverSettings = message.guild && serverConfig.find(s => s.id === message.guild.id);
    var replyChannel = serverSettings && serverSettings.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel

    //Find the account link.
    var nexusUser = linkedAccounts.get(message.author.id)
    if (!nexusUser) return message.channel.send("You don't seem to have an account linked at the moment. See `!nexus link` for more information.")//console.log(`No user to unlink for ${message.author.tag}`)

    if (message.guild) {
        //unlink from a single server
        await exports.unlink(message.author, nexusUser, message.guild)
        if (nexusUser.serversLinked.length === 0) linkedAccounts.delete(message.author.id)

        replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : "" }The link to your Nexus Mods account "${nexusUser.nexusName}" in ${message.guild.name} was removed successfully.\nTo relink in the server type \`!nexus link\`.`).catch(console.error)
    }
    else {
        //unlink from all servers
        var serversClone = nexusUser.serversLinked.slice(0)
        var iTotalServers = serversClone.length
        for (i = 0; i < iTotalServers; i++) {
            var serverToManage = client.guilds.find(s => s.id === serversClone[i])
            //console.log(serverToManage+" - "+nexusUser.serversLinked[i])
            await exports.unlink(message.author, nexusUser, serverToManage)            
        }   
        message.channel.send(`The link to your Nexus Mods account "${nexusUser.nexusName}" in was removed successfully in ${iTotalServers} servers and your API key has been removed.\nSee \`!nexus link\` to reconnect your account.`).catch(console.error)  
        linkedAccounts.delete(message.author.id)  
    }
}

exports.unlink = async (discordUser, nexusUser, discordServer) => {
    //console.log(`discordUser: ${discordUser.tag}, nexusUser: ${nexusUser.nexusName}, discordServer: ${discordServer.name}`)
    var discordMember = discordServer.members.find(m => m.id === discordUser.id)
    console.log(`${new Date()} - Unlinking ${nexusUser.nexusName} from ${discordUser.tag} in ${discordServer.name}.`)
    var serverSettings = (serverConfig.find(s => s.id === discordServer.id))
    if (discordMember && discordServer.me.hasPermission("MANAGE_ROLES")) {
        var rolesToRemove = []
        if (serverSettings.linkedRole) rolesToRemove.push(serverSettings.linkedRole)
        if (serverSettings.premiumRole) rolesToRemove.push(serverSettings.premiumRole)
        if (serverSettings.supporterRole) rolesToRemove.push(serverSettings.supporterRole)
        if (serverSettings.modAuthorRole) rolesToRemove.push(serverSettings.modAuthorRole)
        //console.log(rolesToRemove)

        if (rolesToRemove.length > 0) await discordMember.removeRoles(rolesToRemove, "API unlink.").catch(console.error)
    }

    if (serverSettings.nexusLogChannel) {
        var logChannel = discordServer.channels.get(serverSettings.nexusLogChannel)
        var unlinkEmbed = new Discord.RichEmbed()
        .setAuthor(`${discordUser.tag} unlinked from Nexus Mods account "${nexusUser.nexusName}"`, discordMember.avatarURL)
        .setColor(0xb4762c)
        .setDescription("For more information, type `!nexus help link`.")
        .setTimestamp(new Date())
        .setFooter("🔗 Nexus Mods API link", client.user.avatarURL)

        logChannel.send(unlinkEmbed).catch(console.error)
    }

    //console.log(`Removing server ${discordServer.id}`)
    if (nexusUser.serversLinked) nexusUser.serversLinked.splice(nexusUser.serversLinked.indexOf(s => s.id === discordServer.id))
    await link.linkedAccounts.set(discordUser.id, nexusUser)
    //console.log(link.linkedAccounts.get(discordUser.id).serversLinked)
}