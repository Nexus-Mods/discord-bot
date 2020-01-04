const { getUserByDiscordId, userEmbed } = require('../api/bot-db.js');
const Discord = require('discord.js');

exports.run = async (client, message) => {
    try {
        const myresult = await getUserByDiscordId(message.author.id);
        //console.log(myresult)
        if (!myresult) return message.channel.send("Failed to get. Not found.");
        return message.channel.send(userEmbed(myresult, message, client))

        const resultEmbed = new Discord.RichEmbed()
        .setTitle(myresult.name)
        .setColor(0xda8e35)
        .setURL(`https://nexusmods.com/users/${myresult.id}`)
        .setThumbnail(myresult.avatar_url)
        .setDescription(myresult.premium ? "Premium Member" : myresult.supporter ? "Supporter" : "Member")
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)
        .setTimestamp(myresult.lastupdate);
        if (myresult.mods) {
            const modstring = myresult.mods.map((mod) => `[${mod.name}](${mod.url}) - ${mod.gameTitle}`);
            resultEmbed.addField(`Mods (${myresult.modauthordownloads} downloads)`, modstring.join("\n"));
        } 
        resultEmbed.addField("Servers linked", myresult.servers.map((guildid) => {
            const guild = client.guilds.find(g => g.id === guildid)
            return guild ? guild.name : "Unknown server: "+guildid
        }).join("\n") || "None");
        
        message.channel.send(resultEmbed);
    }
    catch(err) {
        console.log(err);
    }
}