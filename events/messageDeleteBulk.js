const Discord = require("discord.js");
const serverConfig = require("../serverconfig.json");


module.exports = (client, messages) => {
    var serverSettings = messages.first().guild && serverConfig.find(s => s.id === messages.first().guild.id);
    if (!serverSettings || !serverSettings.logChannel) return //We don't care about this event. 

    const moderationChannel = serverSettings.logChannel ? messages.first().guild.channels.get(serverSettings.logChannel) : undefined
    if (!moderationChannel) return console.error(`Could not locate moderation log channel at ${messages.first().guild.name}`);
    
    if (messages.first().channel === moderationChannel) return //ignore deletes from moderation channel. 
    
    console.log(messages.array().length + " messages deleted in batch at "+messages.first().guild.name)

    var index = 0
    var currentEmbed

    for (var [key, message] of messages) {

        if (index === 0 || !currentEmbed) {
            currentEmbed = new Discord.RichEmbed()
            .setColor(0xbf8282)
            .setTitle(`Deleted Messages`)
            .setDescription(`The following messages have been deleted by a Moderator or Bot`)
            .setTimestamp()
            //.setFooter(`Displaying ${(messages.map(message => message.id).length > 25 ? 25 : messages.map(message => message.id).length)} of ${messages.map(message => message.id).length}`)
        }

        var time = new Date(message.createdTimestamp)
        var info = `**Sent by ${message.author} in ${message.channel}**${message.content ? "\n"+message.content : ""}`+(message.attachments.first() ? `\n**Attachments:** ${message.attachments.map(image => image.proxyURL).join(", ")}` : "" )+(message.embeds.length ? `\n**Embeds:** ${message.embeds.map(item => item.title).join(", ")}` : "" ) //1024 max size
        currentEmbed.addField(`${time.toLocaleTimeString()} ${time.toLocaleDateString('en-GB')} [ID:${message.id}]`,info.substr(0,1024))

        if (index === 24 || message === messages.last()) {
            index = 0 
            moderationChannel.send(currentEmbed)
            currentEmbed = undefined
        }
        index ++
    }
};