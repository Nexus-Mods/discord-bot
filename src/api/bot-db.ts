//Used for reference: https://blog.logrocket.com/setting-up-a-restful-api-with-node-js-and-postgresql-d96d6fc892d8/

// USER MANAGEMENT FUNCTIONS
import { getAllUsers, getCountOfUsers, getUserByDiscordId, getUserByNexusModsName, getUserByNexusModsId, createUser, deleteUser, updateUser, userEmbed, userProfileEmbed } from './users';

// SERVER MANAGEMENT FUNCTIONS
import { getAllServers, getServer, addServer, updateServer, deleteServer } from './servers';

// NEWS MANAGEMENT FUNCTIONS
import { getSavedNews, updateSavedNews, ensureNewsDB } from './news';

// AUTOMOD
import { getAutomodRules, createAutomodRule, deleteAutomodRule, getBadFiles, addBadFile, deleteBadFile } from './automod';

// TIPS
import { getAllTips, addTip, deleteTip, editTip, setApprovedTip } from './tips';

// ROLE CONDITIONS
import { getConditionsForRole, addConditionForRole, changeRoleForConditions, deleteConditionForRole, deleteAllConditionsForRole } from './server_role_conditions';

export {
    getAllUsers, getCountOfUsers, getUserByDiscordId, getUserByNexusModsName, getUserByNexusModsId, createUser, deleteUser, updateUser, userEmbed, userProfileEmbed,
    getAllServers, getServer, addServer, updateServer, deleteServer,
    getSavedNews, updateSavedNews, ensureNewsDB,
    getAutomodRules, createAutomodRule, deleteAutomodRule,
    getBadFiles, addBadFile, deleteBadFile,
    getAllTips, addTip, deleteTip, editTip, setApprovedTip,
    getConditionsForRole, addConditionForRole, changeRoleForConditions, deleteConditionForRole, deleteAllConditionsForRole
};
