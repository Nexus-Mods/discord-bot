const { query } = require('./dbConnect.js');
const { getModsbyUser } = require('./user_mods.js');
const { getServer, getAllServers } = require('./servers.js');
const { getLinksByUser, addServerLink } = require('./user_servers.js');
const Discord = require('discord.js');

const getAllUsers = async () => {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users', (error, result) => {
            if (error) return reject("Failed to get all users.");
            return resolve(result.rows);
        });
    });
}

const getUserByDiscordId = async (discordId) => {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users WHERE d_id = $1', [discordId], (error, result) => {
            if (error) return reject(error);
            //console.log(result.rows);
            resolve(result.rows[0]);
        })
    
    });
}

const getUserByNexusModsName = async (username) => {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [username], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows[0]);
        })
    });
}

const createUser = async (user) => {
    return new Promise(
        (resolve, reject) => {
        query('INSERT INTO users (d_id, id, name, avatar_url, apikey, supporter, premium, servers, lastUpdate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [user.d_id, user.id, user.name, user.avatar_url, user.apikey, user.supporter, user.premium, user.servers, new Date()], 
        (error, results) => {
            if (error) {
                //throw error;
                console.log(error);
                if (error.code === "23505") return reject(`Error ${error.code} - The field ${error.constraint} is not unique.`);
            };
            //console.log("User inserted into the database: "+user.nexusName);
            resolve(true);
        })
        });
}

const deleteUser = (discordId) => {
    return new Promise((resolve, reject) => {
        query('DELETE FROM users WHERE d_id = $1', [discordId], (error, results) => {
            if (error) {
                //throw error;
                reject(false);
            };
            resolve(true);
        });
    });
}

const updateUser = async (discordId, newUser) => {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        newUser.lastupdate = new Date();
        Object.keys(newUser).forEach((key) => {
            query(`UPDATE users SET ${key} = $1 WHERE d_id = $2`, [newUser[key], discordId], (error, results) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

const userEmbed = async (userData, message, client) => {
    const discordUser = client.users.find(u => u.id === userData.d_id);
    const mods = await getModsbyUser(userData.id);
    const servers = await getLinksByUser(userData.id);
    const totalDownloads = (mods) => {
        let downloads = 0;
        mods.forEach(m => downloads += m.total_downloads);
        return downloads;
        }
    let embed = new Discord.RichEmbed()
    .setAuthor("Member Search Results", discordUser.avatarURL)
    .addField("Nexus Mods", `[${userData.name}](https://nexusmods.com/users/${userData.id})\n${userData.premium ? "Premium Member" : userData.Supporter ? "Supporter" : "Member"}`, true)
    .addField("Discord", `${discordUser}\n${discordUser.tag}`, true)
    .setColor(0xda8e35)
    .setThumbnail(userData.avatar_url ? userData.avatar_url : client.user.avatarURL)
    .setTimestamp(userData.lastupdate)
    .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);
    if (mods && mods.length) {
        let modData = mods.map( mod => `[${mod.name}](https://nexusmods.com/${mod.path}) - ${mod.game}`);
        if (modData.length > 5) modData = modData.slice(0,4); //Only show a maximum of 5.
        embed.addField(`My Mods - ${totalDownloads(mods).toLocaleString()} downloads for ${mods.length} mod(s).`, `${modData.join("\n")}\n-----\n[**See all of ${userData.name}'s content at Nexus Mods.**](https://www.nexusmods.com/users/${userData.id}?tab=user+files)`)
    }
    // Show guilds.
    let guilds = servers.map((link) => {
        const guild = client.guilds.find(g => g.id === link.server_id)
        return guild ? guild.name : "Unknown server: "+link.server_id;
    });
    if (guilds.length > 5) {
        const total = guilds.length
        guilds = guilds.splice(0,4);
        guilds.push(`and ${total - 5} more...`);
    } 
    embed.addField(`Account connected in ${servers.length} server(s)`, guilds.join(", ") || "None");

    return embed;
}

const updateRoles = async (userData, guild, bRemove = false) => {
    return new Promise(async (resolve, reject) => {
        const guildMember = await guild.members.find(m => m.id === userData.d_id);
        const guildData = await getServer(guild);
        if (!guildData) return reject('No guild data for '+guild.name);

        // Check we can actually assign roles.
        const botMember = guild.members.find(user => user.id === client.user.id);
        if (!botMember || !botMember.hasPermission('MANAGE_ROLES')) {
            console.log(`${new Date().toLocaleString()} - Permissions in ${guild.name} do not allow role assignment.`);
            return reject(`Permissions in ${guild.name} do not allow role assignment.`);
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
            console.log(`Removing roles from ${guildMember.name} (${userData.name}) in ${guild.name}`);
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
        };

        console.log(`Adding ${rolesToAdd.length} roles to ${guildMember.name} (${userData.name}) in ${guild.name}`);

        if (rolesToAdd.length) guildMember.addRoles(rolesToAdd, 'Nexus Mods Discord link')
            .catch(err => console.log(`${new Date().toLocaleString()} - Could not add roles to ${userData.name} in ${guild.name}`, err));
        
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
                    await updateRoles(userData, guild);
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

module.exports = { getAllUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed, updateRoles, updateAllRoles };