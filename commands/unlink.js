const { getUserByDiscordId, createUser, deleteUser, updateUser } = require('../api/bot-db.js');
const Discord = require('discord.js');


module.exports.help = {
    name: "unlink",
    description: "Removes the link between your Discord account and Nexus Mods account in this server. \n*Send to the bot in a Direct Message to unlink all.*",
    usage: "",
    moderatorOnly: false,
    adminOnly: false 
}

exports.run = async (client, message, args, serverData) => {
    const discordId = message.author.id;
    //Get reply channel from server settings.
    const replyChannel = serverData && serverData.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel;

    // TODO! Staff override manual unlink. 

    // TODO! Reply channel setting from server config.

    let userData = await getUserByDiscordId(discordId);

    if (!userData) return message.channel.send("You don't seem to have an account linked at the moment. See `!nexus link` for more information.").catch(console.error);

    if (message.guild) {
        // When this command triggers inside a server, only unlink that server.
        const guildId = message.guild.id;
        if (userData.servers.indexOf(guildId) === -1) return message.channel.send("Your account is not linked in this server. To delete the link on all servers, please send this command in a DM.");
        newUserData = {servers: userData.servers.filter(s => s !== guildId)};
        await updateUser(discordId, newUserData);

        // TODO! Reply channel setting
        replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : "" }The link to your Nexus Mods account "${userData.name}" in ${message.guild.name} was removed successfully.\nTo relink in the server type \`!nexus link\`.`).catch(console.error);
    }
    else {
        // When this command triggers in a DM, fully remove the account link.

        // TODO! Remove roles from various servers. 

        // TODO! Report the unlink event to the logs.
        
        message.channel.send(`The link to your Nexus Mods account "${userData.name}" in was removed successfully in ${userData.servers.length} servers and your API key has been removed.\nSee \`!nexus link\` to reconnect your account.`).catch(console.error);
        deleteUser(discordId);

    }

}