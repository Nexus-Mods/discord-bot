const Discord = require("discord.js");
const { updateServer } = require('../api/servers.js');

module.exports.help = {
    name: "setup",
    description: "When the bot first joins your server, this command will give you some setup options.",
    usage: "[full mod title]",
    moderatorOnly: false,
    adminOnly: true,
    officialOnly: false 
}

exports.run = async (client, message, args, serverData) => {
    if(message.guild && !message.member.hasPermission("ADMINISTRATOR")) return message.channel.send("This option is only available to server admininstrators.").catch(console.error) //Don't let non-admins mess with these settings.

    if (args.length == 0) {
        if (!message.guild || !serverData) return;
        var getStartedEmbed = new Discord.RichEmbed()
        .setAuthor(message.guild ? message.guild.name : "Direct Message", client.user.avatarURL)
        .setColor(0xda8e35)
        .setTitle("Getting started with the Nexus Mods bot")
        .setDescription(`The Nexus Mods bot integrates some of the features from the Nexus Mods website into your Discord server. Admins can cheeck the current configuration any time by typing !nexus config.\nYou can interact with the bot with the following prefixes: ${client.config.prefix.join(", ")}`)
        //.setThumbnail(client.user.avatarURL)
        .setFooter(`Server ID: ${message.guild.id}`)
        .setTimestamp(new Date())
        .addField("🔗 Link your Nexus Mods account", "Using the `link` command, Discord users can link up their Nexus Mods account. This can then be used to show their profile with the `whois` command.\nMod authors can also feature their mods on their profile card by using `addmymod`.",true)
        .addField("🏆 Show your Nexus Prestige","Create roles to show your roles at Nexus Mods. Including Supporter, Premium and recognised mod author.\nYou can also define a role for users who have their Discord and Nexus Mods accountsl linked up.\nIf you'd like the roles set up automatically use `!nexus setup roles`",true)
        .addField("🔍 Search for mods and games", "Check if Nexus Mods has mods for a game using the `games` command.\nFind mods with `search`. You can also configure your server to default to only one game in the results with `config togglesearch {gamename}`.")

        
        return message.channel.send(getStartedEmbed).catch(console.error) //Explains what we can do.
    }

    //create roles
    if (message.guild && args.join(" ").toLowerCase() === "roles") {
        if (!message.guild.me.hasPermission('MANAGE_ROLES')) return message.channel.send("I'm afraid I don't have permission to setup roles in this server.")
        let nexusLinkRole = serverData.role_linked ? message.guild.roles.find(r => r.id === serverData.role_linked) : undefined
        let nexusrole_premium = serverData.role_premium ? message.guild.roles.find(r => r.id === serverData.role_premium) : undefined
        let nexusrole_supporter = serverData.role_supporter ? message.guild.roles.find(r => r.id === serverData.role_supporter) : undefined
        let nexusrole_author = serverData.role_author ? message.guild.roles.find(r => r.id === serverData.role_author) : undefined

        let createdRoles = [];
        let newData = {};

        if(!nexusLinkRole) {
            const alreadyExists = message.guild.roles.find(r => r.name === "Linked 🔗") ||  message.guild.roles.find(r => r.name === "Nexus Mods 🔗")
            if (alreadyExists) nexusrole_premium = alreadyExists
            const newrole_linked = {
                name:`${serverData.official ? "Linked 🔗" : "Nexus Mods 🔗" }`,
                color: 'white',
                mentionable: false
            }
            nexusLinkRole = await message.guild.createRole(newrole_linked,"Nexus Mods bot command")
            console.log(new Date()+` - Created role ${nexusLinkRole.name} at ${message.guild.name}`)
            newData.role_linked = nexusLinkRole.id
            createdRoles.push(nexusLinkRole)
        }

        if(!nexusrole_premium) {
            var alreadyExists = message.guild.roles.find(r => r.name === "Premium Member 🚀") ||  message.guild.roles.find(r => r.name === "Premium Member 🥇(Nexus Mods)")
            if (alreadyExists) nexusrole_premium = alreadyExists
            else {
                var newrole_premium = {
                    name:`${serverData.official ? "Premium Member 🚀" : "Premium Member 🚀(Nexus Mods)" }`,
                    color: 'GREEN',
                    mentionable: false
                }
                nexusrole_premium = await message.guild.createRole(newrole_premium,"Nexus Mods bot command")
                console.log(new Date()+` - Created role ${nexusrole_premium.name} at ${message.guild.name}`)
                newData.role_premium = nexusrole_premium.id
                createdRoles.push(nexusrole_premium)
            }
            
        }

        if(!nexusrole_supporter) {
            var alreadyExists = message.guild.roles.find(r => r.name === "Supporter 🛡") ||  message.guild.roles.find(r => r.name === "Supporter 🛡 (Nexus Mods)")
            if (alreadyExists) nexusrole_supporter = alreadyExists
            else {
                var newrole_supporter = {
                    name:`${serverData.official ? "Supporter 🛡" : "Supporter 🛡 (Nexus Mods)" }`,
                    color: 'BLUE',
                    mentionable: false
                }
                nexusrole_supporter = await message.guild.createRole(newrole_supporter,"Nexus Mods bot command")
                console.log(new Date()+` - Created role ${nexusrole_supporter.name} at ${message.guild.name}`)
                newData.role_supporter = nexusrole_supporter.id
                createdRoles.push(nexusrole_supporter)
            }
            
        }

        if(!nexusrole_author) {
            var alreadyExists = message.guild.roles.find(r => r.name === "Mod Author 👾") ||  message.guild.roles.find(r => r.name === "Mod Author (Nexus Mods) 👾")
            if (alreadyExists) nexusrole_author = alreadyExists
            else {
                var newMARole = {
                name:`${serverData.official ? "Mod Author 👾" : "Mod Author (Nexus Mods) 👾" }`,
                color: 0x9B59B6,
                mentionable: false
                }
                nexusrole_author = await message.guild.createRole(newMARole,"Nexus Mods bot command")
                console.log(new Date()+` - Created role ${nexusrole_author.name} at ${message.guild.name}`)
                newData.role_author = nexusrole_author.id
                createdRoles.push(nexusrole_author)
            }            
        }

        // fs.writeFile("serverconfig.json", JSON.stringify(serverConfig, null, 2), function(err){
        //     if (err) throw err;
        //     //console.log('The "data to append" was appended to file!')
        // });

        if (newData !== {}) await updateServer(message.guild.id, newData);
        
        if (createdRoles.length > 0) message.channel.send(`Created roles: ${createdRoles.length}`)
        

    }

}