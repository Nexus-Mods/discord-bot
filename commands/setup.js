const configCommand = require("./config.js");
const config = require("./../config.json");
const serverConfig = require("../serverconfig.json");
const Discord = require("discord.js")

module.exports.help = {
    name: "setup",
    description: "When the bot first joins your server, this command will give you some setup options.",
    usage: "[full mod title]",
    moderatorOnly: false,
    adminOnly: true,
    officialOnly: false 
}

exports.run = async (client, message, args) => {
    if(message.guild && !message.member.hasPermission("ADMINISTRATOR")) return message.channel.send("This option is only available to server admininstrators.").catch(console.error) //Don't let non-admins mess with these settings.

    if (args.length == 0) {
        if (message.guild && !serverConfig.find(s => s.id === message.guild.id)) configCommand.createServerEntry(message.guild)
        var getStartedEmbed = new Discord.RichEmbed()
        .setAuthor(message.guild ? message.guild.name : "Direct Message", client.user.avatarURL)//message.guild ? message.guild.iconURL : message.author.avatarURL)
        .setColor(0xda8e35)
        .setTitle("Getting started with the Nexus Mods bot")
        .setDescription(`The Nexus Mods bot integrates some of the features from the Nexus Mods website into your Discord server. Admins can cheeck the current configuration any time by typing !nexus config.\nYou can interact with the bot with the following prefixes: ${config.prefix.join(", ")}`)
        //.setThumbnail(client.user.avatarURL)
        .setFooter(`Server ID: ${message.guild ? message.guild.id : "n/a"}`)
        .setTimestamp(new Date())
        .addField("🔗 Link your Nexus Mods account", "Using the link command, Discord users can link up their Nexus Mods account. This can then be used to show their profile with the whois command.\nMod authors can also feature their mods on their profile card by using addmymod",true)
        .addField("🏆 Show your Nexus Prestige","Create roles to show your roles at Nexus Mods. Including Supporter, Premium and recognised mod author.\nYou can also define a role for users who have their Discord and Nexus Mods accountsl linked up.\nIf you'd like the roles set up automatically use !nexus setup roles",true)
        .addField("🔍 Search for mods and games", "Check if Nexus Mods has mods for a game using the `game` command.\nFind mods with `search`. You can also configure your server to default to only one game in the results with `config togglesearch {gamename}`.")
        .addField("📰 Important updates from Nexus Mods", "If you'd like to recieve important updates from Nexus Mods, set your announcement chanel with `!nexus config announcechannel {channeltag}`.",true)
        .addField("🗒 Log Server Activity", "If enabled, the bot will log actions on the server including message deletions, new members joining and role/name changes.  ",true)

        
        return message.channel.send(getStartedEmbed).catch(console.error) //Explains what we can do.
    }

    var serverData = serverConfig.find(s => s.id === message.guild.id)

    //create roles
    if (message.guild && args.join(" ").toLowerCase() === "roles") {
        if (!message.guild.me.hasPermission('MANAGE_ROLES')) return message.channel.send("I'm afraid I don't have permission to setup roles in this server.")
        var nexusLinkRole = serverData.linkedRole ? message.guild.roles.find(r => r.id === serverData.linkedRole) : undefined
        var nexusPremiumRole = serverData.premiumRole ? message.guild.roles.find(r => r.id === serverData.premiumRole) : undefined
        var nexusSupporterRole = serverData.supporterRole ? message.guild.roles.find(r => r.id === serverData.supporterRole) : undefined
        var nexusModAuthorRole = serverData.modAuthorRole ? message.guild.roles.find(r => r.id === serverData.modAuthorRole) : undefined

        var createdRoles = []

        if(!nexusLinkRole) {
            var alreadyExists = message.guild.roles.find(r => r.name === "Linked 🔗") ||  message.guild.roles.find(r => r.name === "Nexus Mods 🔗")
            if (alreadyExists) nexusPremiumRole = alreadyExists
            var newLinkedRole = {
                name:`${serverData.official ? "Linked 🔗" : "Nexus Mods 🔗" }`,
                color: 'white',
                mentionable: false
            }
            nexusLinkRole = await message.guild.createRole(newLinkedRole,"Nexus Mods bot command")
            console.log(new Date()+` - Created role ${nexusLinkRole.name} at ${message.guild.name}`)
            serverData.linkedRole = nexusLinkRole.id
            createdRoles.push(newLinkedRole)
        }

        if(!nexusPremiumRole) {
            var alreadyExists = message.guild.roles.find(r => r.name === "Premium Member 🚀") ||  message.guild.roles.find(r => r.name === "Premium Member 🥇(Nexus Mods)")
            if (alreadyExists) nexusPremiumRole = alreadyExists
            else {
                var newPremiumRole = {
                    name:`${serverData.official ? "Premium Member 🚀" : "Premium Member 🚀(Nexus Mods)" }`,
                    color: 'GREEN',
                    mentionable: false
                }
                nexusPremiumRole = await message.guild.createRole(newPremiumRole,"Nexus Mods bot command")
                console.log(new Date()+` - Created role ${nexusPremiumRole.name} at ${message.guild.name}`)
                serverData.premiumRole = nexusPremiumRole.id
                createdRoles.push(newPremiumRole)
            }
            
        }

        if(!nexusSupporterRole) {
            var alreadyExists = message.guild.roles.find(r => r.name === "Supporter 🛡") ||  message.guild.roles.find(r => r.name === "Supporter 🛡 (Nexus Mods)")
            if (alreadyExists) nexusSupporterRole = alreadyExists
            else {
                var newSupporterRole = {
                    name:`${serverData.official ? "Supporter 🛡" : "Supporter 🛡 (Nexus Mods)" }`,
                    color: 'BLUE',
                    mentionable: false
                }
                nexusSupporterRole = await message.guild.createRole(newSupporterRole,"Nexus Mods bot command")
                console.log(new Date()+` - Created role ${nexusSupporterRole.name} at ${message.guild.name}`)
                serverData.supporterRole = nexusSupporterRole.id
                createdRoles.push(newSupporterRole)
            }
            
        }

        if(!nexusModAuthorRole) {
            var alreadyExists = message.guild.roles.find(r => r.name === "Mod Author 👾") ||  message.guild.roles.find(r => r.name === "Mod Author (Nexus Mods) 👾")
            if (alreadyExists) nexusModAuthorRole = alreadyExists
            else {
                var newMARole = {
                name:`${serverData.official ? "Mod Author 👾" : "Mod Author (Nexus Mods) 👾" }`,
                color: 0x9B59B6,
                mentionable: false
                }
                nexusModAuthorRole = await message.guild.createRole(newMARole,"Nexus Mods bot command")
                console.log(new Date()+` - Created role ${nexusModAuthorRole.name} at ${message.guild.name}`)
                serverData.modAuthorRole = nexusModAuthorRole.id
                createdRoles.push(newMARole)
            }            
        }

        fs.writeFile("serverconfig.json", JSON.stringify(serverConfig, null, 2), function(err){
            if (err) throw err;
            //console.log('The "data to append" was appended to file!')
        });
        
        if (createdRoles.length > 0) message.channel.send(`Created roles: ${createdRoles.length}`)
        

    }

}