const Promise = require('bluebird');
const { query } = require('../api/dbConnect.js');
const { getAllUsers, getAllServers, getUserByDiscordId, createUser, updateAllRoles, getLinksByUser, addServerLink } = require('../api/bot-db.js');

exports.run = (client, message, args, serverData) => {
    if (!client.config.ownerID.includes(message.author.id)) return message.reply('Not authorised.');

    query('DELETE FROM user_servers', [], (err) => err ? console.log(err) : callback(client));
    message.channel.send('Checking links.');
    message.delete();
}

async function callback(client) {
    const users = await getAllUsers();
    const servers = await getAllServers();

    return Promise.map(servers, server => {
        const guild = client.guilds.find(g => g.id === server.id);
        if (!guild) return console.log('No server found for id', server.id);
        console.log(`Checking links for ${guild}`);
        users.forEach(async (user) => {
            const guildMember = guild.members.find(m => m.id === user.d_id);
            if (!guildMember) return console.log(`${user.name} is not a member of ${guild}.`);
            console.log(`Adding link: ${user.name}, ${guild}`);
            return await addServerLink(user, guildMember.user, guild);
        });
    });

}