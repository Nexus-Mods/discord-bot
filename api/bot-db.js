//Used for reference: https://blog.logrocket.com/setting-up-a-restful-api-with-node-js-and-postgresql-d96d6fc892d8/

// USER MANAGEMENT FUNCTIONS
const { getAllUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed, updateRoles, updateAllRoles } = require('./users.js');

// USER MOD FUNCTIONS 
const { getModsbyUser, createMod, deleteMod, updateMod } = require('./user_mods.js');

// SERVER MANAGEMENT FUNCTIONS
const { getAllServers, getServer, addServer, updateServer, deleteServer } = require('./servers.js');

// NEWS MANAGEMENT FUNCTIONS
const { getSavedNews, updateSavedNews } = require('./news.js');

// GAME FEED MANAGEMENT
const { getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed } = require('./game_feeds.js');

// USER SERVER LINK MANAGEMENT

const { getLinksByUser, addServerLink, deleteServerLink, deleteAllServerLinksByUser } = require('./user_servers.js');

module.exports = {
                    getAllUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed, updateRoles, updateAllRoles,
                    getModsbyUser, createMod, deleteMod, updateMod, 
                    getAllServers, getServer, addServer, updateServer, deleteServer,
                    getSavedNews, updateSavedNews,
                    getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed,
                    getLinksByUser, addServerLink, deleteServerLink, deleteAllServerLinksByUser                  
                };

const modTotal = (allMods) => {
    let downloads = 0;
    allMods.forEach(m => m.unique_downloads ? downloads += m.unique_downloads : null );
    return downloads;
}

// USER ROLE FUNCTIONS

// exports.updateAllRoles = async (userData, message, client) => {
//     return new Promise(async (resolve, reject) => {
//         try {
//             const servers = await getAllServers();
//             let newServers = userData.servers;

//             for (server of servers) {
//                 const guild = client.guilds.find(s => s.id === server.id);
//                 const member = guild ? guild.members.find(m => m.id === userData.d_id) : undefined;
//                 // If the guild is not found.
//                 if (!member || !guild) continue;

//                 // If this server is not registered, add it to the list. 
//                 if (newServers.indexOf(guild.id) === -1) newServers.push(guild.id);

//                 const botMember = guild.members.find(m => m.id === client.user.id);
//                 if (!botMember.hasPermission('MANAGE_ROLES')) {
//                     console.log(`${new Date().toLocaleString()} - Permissions in ${guild.name} do not allow role assignment.`);
//                     continue;
//                 }


//                 let rolesToAdd = [];
                
//                 // Get the roles
//                 const premiumRole = server.role_premium ? guild.roles.find(r => r.id === server.role_premium) : undefined;
//                 const supporterRole = server.role_supporter ? guild.roles.find(r => r.id === server.role_premium) : undefined;
//                 const linkedRole = server.role_linked ? guild.roles.find(r => r.id === server.role_supporter) : undefined;
//                 const modAuthorRole = server.role_author ? guild.roles.find(r => r.id === server.role_supporter) : undefined;
//                 const modAuthorDownloads = server.author_min_downloads || 1000;

//                 // Get the unique download total for mods - TODO!
//                 const allUserMods = [];
                
//                 // Assign linked role.
//                 if (linkedRole && !member.roles.has(linkedRole)) rolesToAdd.push(linkedRole.id);

//                 // Assign mod author role.
//                 if (modAuthorRole && modTotal(allUserMods) >= modAuthorDownloads && !member.roles.has(modAuthorRole)) {
//                     rolesToAdd.push(modAuthorRole.id);
//                     member.send(`Congratulations! You are now a recognised mod author in ${guild.name}!`);
//                 };

//                 // Assign membership role
//                 if (userData.premium && premiumRole && !member.roles.has(premiumRole))  rolesToAdd.push(server.role_premium)
//                 else if (userData.supporter && supporterRole && !member.roles.has(supporterRole)) rolesToAdd.push(server.role_premium);

//                 member.addRoles(rolesToAdd, 'Nexus Mods Discord link')
//                 .then(() => console.log(`${new Date().toLocaleString()} - Updated roles for ${userData.name} (${member.user.tag}) in ${guild.name}`))
//                 .catch(err => console.error(`${new Date().toLocaleString()} - Failed to update roles for ${userData.name} in ${guild.name}`, err));

//             }

//             if (newServers !== userData.servers) {
//                 // Update any servers not on our profile card.
//                 await exports.updateUser(userData.d_id, {servers: newServers});
//             }

//             resolve();
//         }
//         catch(err) {
//             console.log('Error updating user roles', err);
//             reject('Error updating user roles \n'+ err);
//         }
        
//     });

// }