const { query } = require('./dbConnect.js');
const { getServer, getAllServers } = require('./servers.js');

const getLinksByUser = (userId) => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM user_servers WHERE user_id = $1', [userId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });

    });
}

const addServerLink = async (user, discordUser, server) => {
    if (typeof(user.id) !== "number") throw new Error(`Invalid member ID. ${user.id} for ${user.name}.`);
    if (!discordUser) throw new Error(`Invalid Discord User for ${user.name}.`);
    if (typeof(server.id) !== "string") throw new Error(`Invalid server ID. ${server.id} for ${server}.`);

    return new Promise((resolve, reject) => {
        query('INSERT INTO user_servers (user_id, server_id) VALUES ($1, $2)', [user.id, server.id], async (error, result) => {
            if (error) return reject(error);
            await updateRoles(user, discordUser, server);
            resolve();
        });
    });
}

const deleteServerLink = async (user, discordUser, server) => {
    return new Promise( (resolve, reject) => {
        query('DELETE FROM user_servers WHERE user_id = $1 AND server_id = $2', [user.id, server.id], async (error, result) => {
            if (error) return reject(error);
            await updateRoles(user, discordUser, server, true);
            resolve();
        });
    });
}

const deleteAllServerLinksByUser = async (user, discordUser, client) => {
    const links = await getLinksByUser(user.id);

    return new Promise((resolve, reject) => {
        query('DELETE FROM user_servers WHERE user_id = $1', [user.id], async (error, result) => {
            if (error) return reject(error);
            for (link of links) {
                const server = client.guilds.find(g => g.id === link.server_id);
                if (server) await updateRoles(user, discordUser, server, true);
            }
            resolve();
        });
    });
}

const updateRoles = async (userData, discordUser, guild, bRemove = false) => {
    return new Promise(async (resolve, reject) => {
        const guildMember = discordUser//await guild.members.find(m => m.id === userData.d_id);
        const guildData = await getServer(guild);
        if (!guildData) return reject('No guild data for '+guild.name);
        if (!guildMember) return resolve(console.log(`${new Date().toLocaleString()} - ${userData.name} is not a member of ${guild.name}`));

        // Check we can actually assign roles.
        const botMember = guild.members.find(user => user.id === client.user.id);
        if (!botMember || !botMember.hasPermission('MANAGE_ROLES')) {
            console.log(`${new Date().toLocaleString()} - Permissions in ${guild.name} do not allow role assignment.`);
            return resolve(console.log(`${new Date().toLocaleString()} - Permissions in ${guild.name} do not allow role assignment.`));
        }

        let rolesToAdd = [];
        
        // Get the roles
        const premiumRole = guildData.role_premium ? guild.roles.find(r => r.id === guildData.role_premium) : undefined;
        const supporterRole = guildData.role_supporter ? guild.roles.find(r => r.id === guildData.role_premium) : undefined;
        const linkedRole = guildData.role_linked ? guild.roles.find(r => r.id === guildData.role_supporter) : undefined;
        const modAuthorRole = guildData.role_author ? guild.roles.find(r => r.id === guildData.role_supporter) : undefined;
        const modAuthorDownloads = guildData.author_min_downloads || 1000;

        // Collect all the ids for removal. 
        const allRoles = [
            premiumRole ? premiumRole.id : '', 
            supporterRole ? supporterRole.id : '', 
            linkedRole ? linkedRole.id : '', 
            modAuthorRole ? modAuthorRole.id : ' '
        ];

        // Remove all roles if we're unlinking.
        if (bRemove) {
            console.log(`${new Date().toLocaleString()} - Removing roles from ${guildMember.user.tag} (${userData.name}) in ${guild.name}`);
            guildMember.removeRoles(allRoles.filter(r => r !== ''), 'Nexus Mods Discord unlink')
                .catch(err => console.log(`${new Date().toLocaleString()} - Could not remove roles from ${userData.name} in ${guild.name}`, err));
            return resolve(true);
        }

        // Linked role
        if (linkedRole && !guildMember.roles.has(linkedRole)) rolesToAdd.push(linkedRole.id);

        // Membership roles
        if (userData.premium && premiumRole && !guildMember.roles.has(premiumRole)) rolesToAdd.push(premiumRole.id)
        else if (userData.supporter && supporterRole && !guildMember.roles.has(supporterRole)) rolesToAdd.push(supporterRole.id);

        // Mod Author role
        if (modAuthorRole && modTotal(allUserMods) >= modAuthorDownloads && !member.roles.has(modAuthorRole)) {
            rolesToAdd.push(modAuthorRole.id);
            member.send(`Congratulations! You are now a recognised mod author in ${guild.name}!`);
        }
        else if (member.roles.has(modAuthorRole)) { guildMember.removeRole(modAuthorRole) };

        if (rolesToAdd.length) {
            console.log(`${new Date().toLocaleString()} - Adding ${rolesToAdd.length} roles to ${guildMember.user.tag} (${userData.name}) in ${guild.name}`);
            guildMember.addRoles(rolesToAdd, 'Nexus Mods Discord link')
            .catch(err => console.log(`${new Date().toLocaleString()} - Could not add roles to ${userData.name} in ${guild.name}`, err));
        };
        
        return resolve(true);


    });
}

const updateAllRoles = async (userData, client, addAll = false) => {
    return new Promise(async (resolve, reject) => {
        const servers = await getAllServers();
        const links = await getLinksByUser(userData.id);
        for(server of servers) {
            const guild = client.guilds.find(g => g.id === server.id);
            const existingLink = !!links.find(l => l.server_id);
            if (guild) {
                if (addAll || existingLink) {
                    await updateRoles(userData, guild).catch(err => console.warn(`${new Date().toLocaleString()} - Unable to assign roles to ${userData.name}`, err));
                    if (!existingLink) {
                        console.log(`Adding link for ${userData.id}, ${guild.id}`);
                        await addServerLink(userData, guild);

                    };
                }
            }            
        }
        resolve();
    })
}

const modTotal = (allMods) => {
    let downloads = 0;
    allMods.forEach(m => m.unique_downloads ? downloads += m.unique_downloads : null );
    return downloads;
}

module.exports = { getLinksByUser, addServerLink, deleteServerLink, deleteAllServerLinksByUser, updateRoles, updateAllRoles };