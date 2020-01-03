const { getUserByDiscordId, userEmbed } = require('../api/bot-db.js');

exports.run = async (client, message, args, serverData) => {
    //Get reply channel from server settings.
    const replyChannel = serverData && serverData.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel;
    const discordId = message.author.id;
    const userData = await getUserByDiscordId(discordId);
    if (!userData) return message.channel.send("There are no accounts linked to the Discord account "+message.author.tag);
    const profileCard = userEmbed(userData, message, client);
    return replyChannel.send(replyChannel !== message.channel ? message.author: "", profileCard);
}