//Used for reference: https://blog.logrocket.com/setting-up-a-restful-api-with-node-js-and-postgresql-d96d6fc892d8/

// USER MANAGEMENT FUNCTIONS
import { getAllUsers, getUserByDiscordId, getUserByNexusModsName, getUserByNexusModsId, createUser, deleteUser, updateUser, userEmbed, userProfileEmbed } from './users';

// USER MOD FUNCTIONS 
import { getAllMods, getModsbyUser, createMod, deleteMod, updateMod } from './user_mods';

// SERVER MANAGEMENT FUNCTIONS
import { getAllServers, getServer, addServer, updateServer, deleteServer } from './servers';

// NEWS MANAGEMENT FUNCTIONS
import { getSavedNews, updateSavedNews } from './news';

// GAME FEED MANAGEMENT
import { getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed } from './game_feeds';

// MOD FEED MANAGEMENT 
import { getAllModFeeds, getModFeed, getModFeedsForServer, createModFeed, updateModFeed, deleteModFeed } from './mod_feeds';

// USER SERVER LINK MANAGEMENT
import { getAllLinks, getLinksByUser, getLinksByServer, addServerLink, deleteServerLink, deleteServerLinksByUserSilent, deleteServerLinksByServerSilent, deleteAllServerLinksByUser, updateRoles, updateAllRoles, modUniqueDLTotal } from './user_servers';

// INFO MANAGEMENT 
import { getAllInfos, createInfo, deleteInfo, displayInfo } from './infos';

// AUTOMOD
import { getAutomodRules, createAutomodRule } from './automod';

export {
    getAllUsers, getUserByDiscordId, getUserByNexusModsName, getUserByNexusModsId, createUser, deleteUser, updateUser, userEmbed, userProfileEmbed,
    getAllMods, getModsbyUser, createMod, deleteMod, updateMod, 
    getAllServers, getServer, addServer, updateServer, deleteServer,
    getSavedNews, updateSavedNews,
    getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed,
    getAllModFeeds, getModFeed, getModFeedsForServer, createModFeed, updateModFeed, deleteModFeed,
    getAllLinks, getLinksByUser, getLinksByServer, addServerLink, deleteServerLink, deleteAllServerLinksByUser, 
    deleteServerLinksByUserSilent, deleteServerLinksByServerSilent, updateRoles, updateAllRoles, modUniqueDLTotal,
    getAllInfos, createInfo, deleteInfo, displayInfo,
    getAutomodRules, createAutomodRule
};
