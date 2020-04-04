const Discord = require('discord.js');
const { getAllInfos, createInfo, deleteInfo, displayInfo } = require('../api/bot-db.js');

let cachedInfo;

module.exports.help = {
    name: "i",
    description: "Quick command for displaying an info topic.",
    usage: "[query]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

exports.run = async (client, message, args, serverData) => {
    const replyChannel = serverData && serverData.channel_bot ? message.guild.channels.find(c => c.id === serverData.channel_bot) : message.channel;

    if (!cachedInfo) {
        const data = await getAllInfos();
        const lastUpdate = new Date();
        cachedInfo = { data, lastUpdate };
        console.log(cachedInfo);
    }

    // No arguements specified.
    if (!args || !args.length) {
        const embed = new Discord.RichEmbed()
        .setColor(0xda8e35)
        .setTitle('Info Command Help')
        .setDescription('This command will return an embed or message based on a preset help topic.\nUse `!nm i {topic}` to invoke this command.')
        .addField('Available Topics (case insensitive)', cachedInfo.data.map(i => `${i.title} [${i.name}]`).join("\n").substr(0, 1024))
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);

        return replyChannel.send(replyChannel !== message.channel ? message.author : '', embed);
    }

    const query = args[0].toLowerCase();
    const result = cachedInfo.data.find(i => i.name.toLowerCase() === query.trim());
    if (!result) return replyChannel.send(`${replyChannel !== message.channel ? `${message.author}, ` : ''}No matching info documents found for "${query}".`);

    return displayInfo(client, message, result);
}