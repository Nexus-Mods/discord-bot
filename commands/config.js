const serverConfig = require("../serverconfig.json");
const Discord = require('discord.js');
const nexusAPI = require('./../nexus-discord.js');
const fs = require("fs");

module.exports.help = {
    name: "config",
    description: "Configure the settings for your server.",
    usage: "[setting] [newvalue]",
    moderatorOnly: false,
    adminOnly: true,
    officialOnly: false 
}

exports.run = async (client, message, serverData) => {    

    if (!message.guild || !serverData) return //ignore DMs

    if(!message.member.hasPermission("MANAGE_CHANNELS")) return message.channel.send("Server configuration is only available to admininstrators."); //Don't let non-admins mess with these settings.

    if (args.length !== 0) {
        //console.log(args)
        switch (args[0]) {
            case "logging":
                setChannel("logging", args.slice(1), serverData, message);
                break;
            case "nexuslog":
                setChannel("nexuslog", args.slice(1), serverData, message);
                break;
            case "botchannel":
                setChannel("botchannel", args.slice(1), serverData, message);
                break;
            case "newschannel":
                setChannel("botchannel", args.slice(1), serverData, message);
                break;
            case "linkedrole":
                setRole("linkedrole"), args.slice(1), serverData, message);
                break;
            case "premiumrole":
                setRole("premiumrole"), args.slice(1), serverData, message);
                break;
            case "supporterrole":
                setRole("supporterrole"), args.slice(1), serverData, message);
                break;
            case "authorrole":
                setRole("authorrole"), args.slice(1), serverData, message);
                break;
            default: 
                return message.reply(`"${args[0]}" is an invalid command for config.`);       
        }

        //Turn off the logging and clear the saved info. 
        if (args[0] === "loggingoff" && serverInfo.logging) {
            serverInfo.logging = false
            delete serverInfo.logChannel
            //console.log(serverConfig)
            updateJSON(serverConfig)
            return message.channel.send("Logging is disabled.")
        }
        //Turn on the logging if a channel is specified. 
        if (args[0] == "loggingon" && !serverInfo.logging && args[1]) {
            var newLogChannel = message.mentions.channels.first() ? message.mentions.channels.first() : message.guild.channels.find(c => c.id === args[1]) ? message.guild.channels.find(c => c.id === args[1]) : undefined
            if (newLogChannel) {
                serverInfo.logging = true
                serverInfo.logChannel = newLogChannel.id
                updateJSON(serverConfig)
                return message.channel.send("Logging enabled in "+newLogChannel)
            }
            else {
                message.channel.send("Please specify a channel or channel ID.")
            }
        }
        if (args[0] === "nexuslog") {
            var newNexusChannel = message.mentions.channels.first() ? message.mentions.channels.first() : message.guild.channels.find(c => c.id === args[1]) ? message.guild.channels.find(c => c.id === args[1]) : undefined
            if (newNexusChannel) {
                serverInfo.nexusLogChannel = newNexusChannel.id
                updateJSON(serverConfig)
                return message.channel.send("Nexus Mods Bot events will be sent to "+newNexusChannel)
            }
            else {
                //serverInfo.defaultChannel = "" going to remove it entirely instead.
                delete serverInfo.nexusLogChannel
                updateJSON(serverConfig)
                return message.channel.send("Nexus Mods logging has been turned off.")
            }
        }
        if (args[0] === "botchannel") {
            var newDefaultChannel = message.mentions.channels.first() ? message.mentions.channels.first() : message.guild.channels.find(c => c.id === args[1]) ? message.guild.channels.find(c => c.id === args[1]) : undefined
            if (newDefaultChannel) {
                serverInfo.defaultChannel = newDefaultChannel.id
                updateJSON(serverConfig)
                return message.channel.send("The bot will now only reply in "+newDefaultChannel)
            }
            else {
                //serverInfo.defaultChannel = "" going to remove it entirely instead.
                delete serverInfo.defaultChannel
                updateJSON(serverConfig)
                return message.channel.send("The bot will now reply in the same channel the command is given.")
            }
        }
        if (args[0] === "announcechannel") {
            var newAnnouncementsChannel = message.mentions.channels.first() ? message.mentions.channels.first() : message.guild.channels.find(c => c.id === args[1]) ? message.guild.channels.find(c => c.id === args[1]) : undefined
            if (newAnnouncementsChannel) {
                serverInfo.announcementChannel = newAnnouncementsChannel.id
                updateJSON(serverConfig)
                return message.channel.send("Nexus Mods news and announcements will be posted in "+newAnnouncementsChannel)
            }
            else {
                //serverInfo.announcementChannel = ""
                delete serverInfo.announcementChannel
                updateJSON(serverConfig)
                return message.channel.send("Nexus Mods news and announcements will not longer be posted.")
            }
        }


        if (args[0].endsWith("role")) {
            //Resolve the command into the role name.
            var roleToChange = args[0] === "linkedrole" ? "Connected Accounts Role" : args[0] === "premiumrole" ? "Premium Member Role" : args[0] === "supporterrole" ? "Supporter Role" : args[0] === "authorrole" ? "Mod Author Role" : undefined
            if (roleToChange === undefined) return message.channel.send(`Unrecognised role command `+ args[0]) //Reject invalid role names

            var oldRole //Define this so we can save the old role. 

            var newRole = message.mentions.roles.first() ? message.mentions.roles.first() : message.guild.roles.find(c => c.id === args[1]) ? message.guild.roles.find(c => c.id === args[1]) : undefined
            if (roleToChange === "Connected Accounts Role") {
                oldRole = message.guild.roles.find(r => r.id === serverInfo.linkedRole) ? message.guild.roles.find(r => r.id === serverInfo.linkedRole) : "*none*"
                serverInfo.linkedRole = newRole ? newRole.id : ""
                if (!newRole) delete serverInfo.linkedRole
            }
            else if (roleToChange === "Premium Member Role") {
                oldRole = message.guild.roles.find(r => r.id === serverInfo.premiumRole) ? message.guild.roles.find(r => r.id === serverInfo.premiumRole) : "*none*"
                serverInfo.premiumRole = newRole ? newRole.id : ""
                if (!newRole) delete serverInfo.premiumRole
            }
            else if (roleToChange === "Supporter Role") {
                oldRole = message.guild.roles.find(r => r.id === serverInfo.supporterRole) ? message.guild.roles.find(r => r.id === serverInfo.supporterRole) : "*none*"
                serverInfo.supporterRole = newRole ? newRole.id : ""
                if (!newRole) delete serverInfo.supporterRole
            }
            else if (roleToChange === "Mod Author Role") {
                oldRole = message.guild.roles.find(r => r.id === serverInfo.modAuthorRole) ? message.guild.roles.find(r => r.id === serverInfo.modAuthorRole) : "*none*"
                serverInfo.modAuthorRole = newRole ? newRole.id : ""
                if (args[2] && Number(args[2])) serverInfo.modAuthorDownloadMinimum = args[2]
                else serverInfo.modAuthorDownloadMinimum = 1000
                if (!newRole) {
                    delete serverInfo.modAuthorRole
                    delete serverInfo.modAuthorDownloadMinimum
                }
            }
            updateJSON(serverConfig)
            const roleUpdatedEmbed = new Discord.RichEmbed()
            .setTitle("Server Configuration")
            .setDescription(`Updated value for ${roleToChange ? roleToChange : undefined}.`)
            .setColor(0xda8e35)
            .setAuthor(message.guild, message.guild.iconURL)
            .addField("Old Role", oldRole ? oldRole : "*none*", true)
            .addField("New Role", newRole ? newRole : "*none*", true)
            .setFooter(`Server ID: ${message.guild.id}`)
            return message.channel.send(roleUpdatedEmbed)
        }
        
        if (args[0] === "togglesearch") {
            //If a game filter has been specified. 
            if (args[1]) {
                await nexusAPI.games(message.author,0).then(
                    (gameList) => {
                        var searchFilter = gameList.find(g => g.domain_name === args[1])
                        if (searchFilter) {
                            return serverInfo.searchGameFilter = {title:searchFilter.name, id: searchFilter.id, domain: searchFilter.nexusmods_url}
                        }
                        else {
                            message.channel.send(`Failed to set game filter: ${args[1]} is not found. Please use the domain name of the game. (e.g. Fallout 4 -> fallout4)`).catch(console.error);
                        }
                    },
                    (error) => {
                        return console.log(`Unable to lookup game. `+error);
                    }
                ).catch(console.error)
            }
            
            //Toggle the search on.
            if (!serverInfo.webhookID || !serverInfo.webhookToken) {
                //var searchWebhook = message.guild.fetchWebhooks().find(h => h.name === "Nexus Mods Quick Search") //Does not appear we can search for existing webhooks without a token.
                if (!message.member.hasPermission("MANAGE_WEBHOOKS")) return message.reply("you do not have permission to create a webhook for the Search.")
                //if (!message.guild.me.hasPermission("MANAGE_WEBHOOKS")) return message.reply("the permissions set for this bot do not allow webhooks to be created.")
                var searchChannel = message.mentions.channels.first() ? message.mentions.channels.first() : message.channel//serverInfo.defaultChannel ? client.channels.get(serverInfo.defaultChannel) : undefined
                if (!searchChannel) return message.reply("Cannot set up search, default channel is not defined. This is the channel search results will be sent to.")
                searchChannel.createWebhook("Nexus Mods Quick Search", client.user.avatarURL)
                .then(webhook => webhook.edit("Nexus Mods Quick Search", client.user.avatarURL)
                .then(function (wb) {
                    serverInfo.webhookID = wb.id
                    serverInfo.webhookToken = wb.token
                    updateJSON(serverConfig)
                    message.channel.send("Search initialised, a webhook has been created."+(serverInfo.searchGameFilter ? " Filtering results to show only: "+serverInfo.searchGameFilter.title: ""))
                }).catch(console.error))

            }
            //toggle the search off
            else {
                if (message.guild.me.hasPermission("MANAGE_WEBHOOKS")) message.guild.fetchWebhooks().then(function (wh) {
                    webhookToRemove = wh.find(wh => wh.id === serverInfo.webhookID)
                    webhookToRemove.delete().catch(console.error) //Delete the current webhook, if possible.
                }).catch(console.error)
                .then(function () {
                    delete serverInfo.webhookID
                    delete serverInfo.webhookToken
                    delete serverInfo.searchGameFilter
                    updateJSON(serverConfig)
                    return message.channel.send("Search has been turned off.")
                })
            }
        }
    }
    else { //no arguements so print the info we know.
        const serverID = serverInfo.id
        serverInfo.name = message.guild.name
        const serverName = serverInfo.name
        const linked = serverInfo.linkedRole ? message.guild.roles.find(c => c.id === serverInfo.linkedRole) : null;
        const premium = serverInfo.premiumRole ? message.guild.roles.find(c => c.id === serverInfo.premiumRole) : null;
        const supporter = serverInfo.supporterRole ? message.guild.roles.find(c => c.id === serverInfo.supporterRole) : null;
        const modAuthor = serverInfo.modAuthorRole ? message.guild.roles.find(c => c.id === serverInfo.modAuthorRole) : null;
        const logChannel = serverInfo.logChannel ? message.guild.channels.find(c => c.id === serverInfo.logChannel) : null;
        const nexusLogChannel = serverInfo.nexusLogChannel ? message.guild.channels.find(c => c.id === serverInfo.nexusLogChannel) : null;
        const defaultChannel = serverInfo.defaultChannel ? message.guild.channels.find(c => c.id === serverInfo.defaultChannel) : null;
        const announceChannel = serverInfo.announcementChannel ? message.guild.channels.find(c => c.id === serverInfo.announcementChannel) : null;
        const searchWebhook = serverInfo.webhookID && serverInfo.webhookToken ? await message.guild.fetchWebhooks()
        .then((wl) => wl.find(w => w.id === serverInfo.webhookID)) : undefined;
        const searchChannel = searchWebhook ? message.guild.channels.find(c => c.id === searchWebhook.channelID) : undefined;
        if (!serverInfo.modAuthorDownloadMinimum) serverInfo.modAuthorDownloadMinimum = 1000;
        
        const serverInfoEmbed = new Discord.RichEmbed()
        .setTitle(`Server Configuration`)
        .setDescription("Configure any of these options for your server by typing the following command: \n`!NM config <setting> <newvalue>`")
        .setColor(0xda8e35)
        .setAuthor(serverName, message.guild.iconURL)
        .addField("Connected Accounts Role", `${linked ? linked : '*undefined*'} \nSet using \`linkedrole <role>\``, true)
        .addField("Nexus Mods Premium Role", `${premium ? premium : '*undefined*'} \nSet using \`premiumrole <role>\``, true)
        .addBlankField()
        .addField("Nexus Mods Supporter Role", `${supporter ? supporter : '*undefined*'} \nSet using \`supporterrole <role>\``,true)
        .addField("Nexus Mods Author Role", `${modAuthor ? modAuthor : '*undefined*'} ${modAuthor ? `\nAuthors with ${serverInfo.modAuthorDownloadMinimum}+ mod downloads.`: ""}\nSet using \`authorrole <role> <downloads>\``, true)
        .addField("Channels Settings", `**Announcements and News:** ${announceChannel ? announceChannel : "*undefined*"} \nUpdates for Nexus Mods. Set using \`announcechannel <channel>\` \n\n**Bot:** ${defaultChannel ? `${defaultChannel} \nTo bot will only respond to commands here. Set using \`botchannel <channel>\`` : `_Not set._ \nTo bot will respond to commands in all channels. Set using \`botchannel <channel>\``}\n`)
        .addField("Activity Logging", serverInfo.logging ? `Enabled in ${logChannel} \nTurn off using \`loggingoff\`` : "Disabled \nTurn on using `loggingon <channel>`",true)
        .addField("Nexus Mods Logging", serverInfo.nexusLogChannel ? `Enabled in ${nexusLogChannel} \nTurn off using \`nexuslog\`` : "Disabled \nTurn on using `nexuslog <channel>`",true)
        .addField("Search", `${serverInfo.webhookID && serverInfo.webhookToken ? `Enabled in ${searchChannel}. Searching ${serverInfo.searchGameFilter ? serverInfo.searchGameFilter.title : "all"} mods. \nTurn off using \`togglesearch\`` : "Disabled. \nTurn on using `togglesearch` `<gamedomain> <channel>`"}`,true)
        .setFooter(`Server ID: ${serverID}`)
        if (serverInfo.official) serverInfoEmbed.addField("Official Nexus Mods Server", 'This server is an official Nexus Mods server, all bot functions are enabled.')
        
        updateJSON(serverConfig)
        message.channel.send(serverInfoEmbed).catch(console.error);

    }


}

function setChannel(type, args, serverData, message) {
    switch (type) {
        case "logging":
            // DO STUFF
            break;
        case "nexuslog":
            // DO STUFF
            break;
        case "bot":
            // DO STUFF
            break;
        case "news":
            // DO STUFF
            break;
        
    }
}

function logging(serverData, args, message) {
    // Turn logging on or off.
    const newChannel = (message.mentions.channels ? message.mentions.channels.first(): undefined) || (args.length ? message.guild.channels.find(c => c.name === args[0]) || message.guild.channels.find(c => c.id === args[0]) : undefined);
    if (!newChannel)
}

function updateJSON(newJSON) {
    fs.writeFile("serverconfig.json", JSON.stringify(newJSON, null, 2), function(err){
        if (err) throw err;
        //console.log('The "data to append" was appended to file!')
    });
}

exports.createServerEntry = (newGuild) => {
    console.log(newGuild.name+" not found in JSON file. Creating a new entry.") 
    var newData = {
        "id": newGuild.id,
        "name": newGuild.name,
        "official": false,
        //"logging": false,
        //"linkedRole": "",
        //"premiumRole": "",
        //"supporterRole": "",
        //"modAuthorRole": "",
        //"modAuthorDownloadMinimum": 1000,
        //"logChannel": "",
        //"defaultChannel": "",
        //"webhookID": "",
        //"webhookToken":"",
        //"searchGameFilter": undefined,
        //"announcementChannel": ""
    }
    serverConfig.push(newData)
    updateJSON(serverConfig)
    return newData
}

/*
Server Data structure
{
   id: guildId,
   official: nexusModsOffical?,
   channel_bot: previously defaultChannel,
   channel_nexus: previously nexusLogChannel,
   channel_log: previously logChannel,
   role_author: previously modAuthorRole,
   role_premium: previously premiumRole,
   role_supporter: previously supporterRole,
   role_linked: previously linkedRole,
   author_min_downloads: previously modAuthorDownloadMinimum,
   game_filter: previously searchGameFilter,
   search_whid: previously webhookID,
   search_whtoken: previously webhookToken,
   server_owner: guild.ownerID NEW!
}
*/