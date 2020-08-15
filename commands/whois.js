const { getUserByDiscordId, getAllUsers, userEmbed, getLinksByUser } = require('../api/bot-db.js');
const botData = (client) => {
    return {
        d_id: client.user.id,
        id: 1234042,
        name: "Nexus Mods bot",
        avatar_url: client.user.avatarURL,
        premium: false,
        supporter: false,
        servers: client.guilds.map(g => g.id),
        lastupdate: 0
    };
};

exports.run = async (client, message, args, serverData) => {
    //Get reply channel from server settings.
    const replyChannel = serverData && serverData.channel_bot ? message.guild.channels.find(c => c.id === serverData.channel_bot) : message.channel;
    const discordId = message.author.id;

    let userData = await getUserByDiscordId(discordId);

    if (!userData) return replyChannel.send(`${replyChannel === message.channel ? message.author.tag : message.author} please link your Nexus Mods account to use this feature. See \`!nexus link\` for more information.`).catch(console.error);

    if (args.length === 0) return replyChannel.send(`${replyChannel === message.channel ? "" : message.author + " "}Please specify a Discord account or Nexus Mods username to search for.`).catch(console.error);

    const searchQuery = args.join(" ");

    // If you ping the bot itself.
    if (message.mentions.users.first() === client.user || searchQuery === (client.user.username || client.user.tag)) return replyChannel.send(`${replyChannel === message.channel ? "" : message.author+" "}It's me!`, userEmbed(botData(client), message, client)).catch(console.error);

    // Get all user accounts so we can search it. 
    const allUsers = await getAllUsers();

    // If there is a #0000 at the end, it's probably a Discord tag.
    const discordTag = searchQuery.match(/.*[0-9]{4}/) ? searchQuery.trim() : undefined;
    // Get Discord account by checking mentions, Discord ID, Discord Tag, Discord Display Name
    let discordUser = await message.mentions.members.first() 
    || allUsers.find(user => user.d_id === searchQuery) ? await client.users.find(dUser => dUser.id === searchQuery) : undefined
    || discordTag ? await client.users.find(u => u.tag.toLowerCase() === discordTag.toLowerCase()) : undefined 
    || await client.users.find(u => u.username.toLowerCase() === args[0].toLowerCase());
    // Get Nexus account by searching Discord ID or username
    let userInfo = discordUser ? allUsers.find(user => user.d_id === discordUser.id) : allUsers.find(user => user.name === searchQuery);

    // If we found a Nexus User but not a Discord one, we can extrapolate it. 
    if (!discordUser && userInfo) discordUser = await client.users.find(dUser => dUser.id === userInfo.d_id);

    console.log(`${new Date().toLocaleString()} - Whois lookup ${discordUser ? discordUser.tag || discordUser.user.tag : "Discord not found"}, ${userInfo ? userInfo.name : "Nexus Mods not found."}`);

    // If one of the two accounts is missing, no match was found.
    if (!discordUser || !userInfo) return replyChannel.send(`${replyChannel === message.channel ? "" : message.author + " "}No members found for "${searchQuery}".`).catch(console.error);

    // Get the servers for this user
    const links = await getLinksByUser(userInfo.id);
    const servers = links.map(s => s.server_id);

    // Check if they share a server
    if (userInfo.d_id !== message.author.id && message.guild && servers.indexOf(message.guild.id) !== -1) return replyChannel.send(`${replyChannel === message.channel ? "" : message.author + " "}You do not share a server with "${discordUser.tag || discordUser.user.tag} so their information is not available.".`).catch(console.error);

    // Send a profile embed. 
    const embed = await userEmbed(userInfo, message, client);
    replyChannel.send(replyChannel === message.channel ? "" : message.author, embed).catch(console.error);
}  