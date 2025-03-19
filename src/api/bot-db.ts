//Used for reference: https://blog.logrocket.com/setting-up-a-restful-api-with-node-js-and-postgresql-d96d6fc892d8/

// USER MANAGEMENT FUNCTIONS
import { getAllUsers, getUserByDiscordId, getUserByNexusModsName, getUserByNexusModsId, createUser, deleteUser, updateUser, userEmbed, userProfileEmbed } from './users';

// SERVER MANAGEMENT FUNCTIONS
import { getAllServers, getServer, addServer, updateServer, deleteServer } from './servers';

// NEWS MANAGEMENT FUNCTIONS
import { getSavedNews, updateSavedNews, ensureNewsDB } from './news';

// GAME FEED MANAGEMENT
import { getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed } from './game_feeds';

// USER SERVER LINK MANAGEMENT
import { getAllLinks, getLinksByUser, getLinksByServer, addServerLink, deleteServerLink, deleteServerLinksByUserSilent, deleteServerLinksByServerSilent, deleteAllServerLinksByUser, modUniqueDLTotal } from './user_servers';

// AUTOMOD
import { getAutomodRules, createAutomodRule, deleteAutomodRule, getBadFiles, addBadFile  } from './automod';

// TIPS
import { getAllTips, addTip, deleteTip, editTip, setApprovedTip } from './tips';

// ROLE CONDITIONS
import { getConditionsForRole, addConditionForRole, changeRoleForConditions, deleteConditionForRole, deleteAllConditionsForRole } from './server_role_conditions';

export {
    getAllUsers, getUserByDiscordId, getUserByNexusModsName, getUserByNexusModsId, createUser, deleteUser, updateUser, userEmbed, userProfileEmbed,
    getAllServers, getServer, addServer, updateServer, deleteServer,
    getSavedNews, updateSavedNews, ensureNewsDB,
    getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed,
    getAllLinks, getLinksByUser, getLinksByServer, addServerLink, deleteServerLink, deleteAllServerLinksByUser, 
    deleteServerLinksByUserSilent, deleteServerLinksByServerSilent, modUniqueDLTotal,
    getAutomodRules, createAutomodRule, deleteAutomodRule,
    getBadFiles, addBadFile,
    getAllTips, addTip, deleteTip, editTip, setApprovedTip,
    getConditionsForRole, addConditionForRole, changeRoleForConditions, deleteConditionForRole, deleteAllConditionsForRole
};
