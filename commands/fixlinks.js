const Promise = require('bluebird');
const { query } = require('../api/dbConnect.js');
const { getAllUsers, getAllServers, getUserByDiscordId, createUser, updateAllRoles, getLinksByUser, addServerLink } = require('../api/bot-db.js');

exports.run = (client, message, args, serverData) => {
    if (!client.config.ownerID.includes(message.author.id)) return message.reply('Not authorised.');

    query('DELETE FROM user_servers', [], () => callback(client));
}

async function callback(client) {
    const users = await getAllUsers();
    const servers = await getAllServers();

    return Promise.map(servers, server => {
        const guild = client.guilds.find(g => g.id = server.id);
        if (!guild) return console.log('No server found for id', server.id);
        const guildMembers = guild.members.filter(member => users.find(u => u.d_id === member.id));
        console.log(`${guildMembers.size} members in ${guild}`);
        guildMembers.forEach(async (member) => {
            const user = users.find(u => u.d_id === member.id);
            console.log(`Adding link: ${user.name}, ${guild}`);
            return await addServerLink(user, member.user, guild);
        });
    });

}