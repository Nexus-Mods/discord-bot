const Discord = require('discord.js');
const serverConfig = require("../serverconfig.json");

module.exports = (client, message) => {
    var serverSettings = message.guild && serverConfig.find(s => s.id === message.guild.id);
    if (!serverSettings || !serverSettings.logChannel) return; //We don't care about this event. 

    const moderationChannel = serverSettings.logChannel ? message.guild.channels.get(serverSettings.logChannel) : undefined
    if (!moderationChannel) return console.error(`Could not locate moderation log channel at ${message.guild.name}`);

    if (message.channel === moderationChannel) return; //ignore deletes from moderation channel.

    if (message.author === client.user) return; //ignore deleted bot posts.
    
    console.log(`Message ${message.id} deleted at ${message.guild}`);

    for (const thisprefix of client.config.prefix) {
        if (message.content.startsWith(thisprefix)) return; //console.log("Ignoring message: " +message.content) //ignore deleted bot commands.
    };
    var deleteReport = new Discord.RichEmbed()
    .setAuthor("Deleted Message",message.author.avatarURL)
    .setColor(0xbf8282)
    .setDescription(`**Sent by ${message.author} in ${message.channel}**\n${message.content}`)
    .setTimestamp(message.createdAt)
    .setFooter("ID:"+message.id+" - "+message.guild, message.guild.iconURL);

    if (message.attachments.first()) {
        deleteReport.addField("Attachments",  message.attachments.map(image => image.proxyURL).join("\n"))
        .setImage(message.attachments.first().proxyURL);
    }

    if (message.embeds.length) {
        let embedString = message.embeds.map(item => item.title);
        if (embedString.length > 0) deleteReport.addField("Embeds", embedString.join("\n"));
    }
    
    moderationChannel.send(deleteReport).catch(console.error);
};