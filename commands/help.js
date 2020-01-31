const Discord = require("discord.js");
const fs = require("fs");

exports.run = (client, message, args, serverData) => {
    //Where should we reply?
    const replyChannel = serverData && serverData.defaultChannel ? message.guild.channels.find(c => c.id === serverData.defaultChannel) : message.channel
    
    //Collect permission settings
    const userPermsModerator = message.guild ? message.member.hasPermission("BAN_MEMBERS") : false
    const userPermsAdminstrator = message.guild ? message.member.hasPermission("ADMINISTRATOR") : false
    const nexusOfficial = serverData ? serverData.official : false

    //If there is no valid command with args
    if (args.length > 0 && !fs.existsSync(`./commands/${args}.js`)) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" ": "" }Could not find a command for "${args.join(" ")}". To see all commands try \`!Nexus help\`.`)

    //Build the embed
    const helpEmbed = new Discord.RichEmbed()
    .setTitle("Nexus Mods Bot Help")
    .setAuthor(client.user.username, client.user.avatarURL)
    .setColor(0xda8e35)
    .setDescription(`All commands for this bot can be accessed with one of the following prefixes: ${client.config.prefix.join(", ")}.`)
    .setFooter(`Nexus Mods bot - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)
    if (!args[0]){
        fs.readdir("./commands/", (err, files) => {
            if (err) return console.error(err);
            files.forEach(file => {
                if (!file.endsWith(".js")) return;
                let props = require(`./${file}`);
                if (!props.help) return; //ignore commands with no helptext.
                if (props.help.adminOnly && !userPermsAdminstrator) return //Admin only functions hidden from others.
                if (props.help.moderatorOnly && !userPermsModerator) return //Stop users seeing moderator actions
                if (props.help.officialOnly && !nexusOfficial) return //Don't show Nexus only functions.
                if (helpEmbed.fields.length === 25) return
                helpEmbed.addField(`${props.help.name} ${props.help.usage}`, props.help.description)
            });

            //if staff, send in a DM.
            if (userPermsAdminstrator || userPermsModerator) return message.author.send("Help message sent via DM as it may contain Moderator/Admin functions", helpEmbed).catch(console.error)
            else return replyChannel.send((replyChannel !== message.channel ? message.author : ""),helpEmbed).catch(console.error)
        });
    }
    else if (args[0]) {
        let props = require(`./${args}.js`)
        //if no help object defined, return error. 
        if (!props.help) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" ": "" }There is no help text available for " ${args.toString()}"`)
        if ((props.help.moderatorOnly && !userPermsModerator) || (props.help.adminOnly && !userPermsAdminstrator) || (props.help.officialOnly && !nexusOfficial)) return replyChannel.send(`${replyChannel !== message.channel ? message.author+" ": "" }You do not have access to the "${args.join(" ")}" command.`)
        helpEmbed.addField(`${props.help.name} ${props.help.usage}`, props.help.description)
        
        if (props.help.adminOnly || props.help.moderatorOnly) return message.author.send("Help message sent via DM as it may contain Moderator/Admin functions", helpEmbed).catch(console.error)
        else return replyChannel.send((replyChannel !== message.channel ? message.author : ""),helpEmbed).catch(console.error)
    }
};  

module.exports.help = {
    name: "help",
    description: "Displays bot functions and their descriptions. Use [command] for a specific command.",
    usage: "[command]",
    moderatorOnly: false,
    adminOnly: false  
}