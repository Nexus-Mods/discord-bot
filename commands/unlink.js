const { getUserByDiscordId, deleteUser } = require('../api/bot-db.js');
const {getLinksByUser, deleteServerLink, deleteAllServerLinksByUser } = require('../api/user_servers.js');
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
    const replyChannel = serverData && serverData.channel_bot ? message.guild.channels.find(c => c.id === serverData.channel_bot) : message.channel;

    // TODO! Staff override manual unlink. 

    let userData = await getUserByDiscordId(discordId);
    const servers = userData? await getLinksByUser(userData.id) : undefined;

    if (!userData) return message.channel.send("You don't seem to have an account linked at the moment. See `!nexus link` for more information.").catch(console.error);

    if (message.guild) {
        // When this command triggers inside a server, only unlink that server.
        const guildId = message.guild.id;
        if (!servers.find(link => link.server_id === guildId)) return message.channel.send("Your account is not linked in this server. To delete the link on all servers, please send this command in a DM.");
        await deleteServerLink(userData, message.author.user, message.guild);

        // TODO! Reply channel setting
        replyChannel.send(`${replyChannel !== message.channel ? message.author+" " : "" }The link to your Nexus Mods account "${userData.name}" in ${message.guild.name} was removed successfully. To relink in this server type \`!nexus link\`.`).catch(console.error);
    }
    else {
        // When this command triggers in a DM, fully remove the account link.

        // Remove roles from various servers and delete from the database. 
        await deleteAllServerLinksByUser(userData, message.author.user, client);
        await deleteUser(discordId);

        // TODO! Report the unlink event to the logs.
        
        message.channel.send(`The link to your Nexus Mods account "${userData.name}" in was removed successfully in ${servers.length} servers and your API key has been removed.\nSee \`!nexus link\` to reconnect your account.`).catch(console.error);

    }

}