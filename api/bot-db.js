//Used for reference: https://blog.logrocket.com/setting-up-a-restful-api-with-node-js-and-postgresql-d96d6fc892d8/

// USER MANAGEMENT FUNCTIONS
const { getAllUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed } = require('./users.js');

// USER MOD FUNCTIONS 
const { getModsbyUser, createMod, deleteMod, updateMod } = require('./user_mods.js');

// SERVER MANAGEMENT FUNCTIONS
const { getAllServers, getServer, addServer, updateServer, deleteServer } = require('./servers.js');

// NEWS MANAGEMENT FUNCTIONS
const { getSavedNews, updateSavedNews } = require('./news.js');

// GAME FEED MANAGEMENT
const { getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed } = require('./game_feeds.js');

// MOD FEED MANAGEMENT 
const { getAllModFeeds, getModFeed, getModFeedsForServer, createModFeed, updateModFeed, deleteModFeed } = require('./mod_feeds.js');

// USER SERVER LINK MANAGEMENT

const { getLinksByUser, addServerLink, deleteServerLink, deleteAllServerLinksByUser, updateRoles, updateAllRoles } = require('./user_servers.js');

module.exports = {
                    getAllUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed, 
                    getModsbyUser, createMod, deleteMod, updateMod, 
                    getAllServers, getServer, addServer, updateServer, deleteServer,
                    getSavedNews, updateSavedNews,
                    getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed,
                    getAllModFeeds, getModFeed, getModFeedsForServer, createModFeed, updateModFeed, deleteModFeed,
                    getLinksByUser, addServerLink, deleteServerLink, deleteAllServerLinksByUser, updateRoles, updateAllRoles                  
                };