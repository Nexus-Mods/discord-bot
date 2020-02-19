require("dotenv").config();
const Pool = require('pg').Pool;
const pool = new Pool({
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: process.env.PORT,
});
const Discord = require('discord.js');

//Used for reference: https://blog.logrocket.com/setting-up-a-restful-api-with-node-js-and-postgresql-d96d6fc892d8/

// USER MANAGEMENT FUNCTIONS

exports.getAllUsers = async () => {
    return new Promise( (resolve, reject) => {
        pool.query('SELECT * FROM users', (error, result) => {
            if (error) return reject("Failed to get all users.");
            return resolve(result.rows);
        });
    });
}

exports.getUserByDiscordId = async (discordId) => {
    return new Promise( (resolve, reject) => {
        pool.query('SELECT * FROM users WHERE d_id = $1', [discordId], (error, result) => {
            if (error) return reject(error);
            //console.log(result.rows);
            resolve(result.rows[0]);
        })
    
    });
}

exports.getUserByNexusModsName = async (username) => {
    return new Promise( (resolve, reject) => {
        pool.query('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [username], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows[0]);
        })
    });
}

exports.createUser = async (user) => {
    return new Promise(
        (resolve, reject) => {
        pool.query('INSERT INTO users (d_id, id, name, avatar_url, apikey, supporter, premium, servers, lastUpdate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
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

exports.deleteUser = (discordId) => {
    return new Promise((resolve, reject) => {
        pool.query('DELETE FROM users WHERE d_id = $1', [discordId], (error, results) => {
            if (error) {
                //throw error;
                reject(false);
            };
            resolve(true);
        });
    });
}

exports.updateUser = async (discordId, newUser) => {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        newUser.lastupdate = new Date();
        Object.keys(newUser).forEach((key) => {
            pool.query(`UPDATE users SET ${key} = $1 WHERE d_id = $2`, [newUser[key], discordId], (error, results) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

exports.userEmbed = async (userData, message, client) => {
    const discordUser = client.users.find(u => u.id === userData.d_id);
    const mods = await exports.getModsbyUser(userData.id);
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
    let guilds = userData.servers.map((guildid) => {
        const guild = client.guilds.find(g => g.id === guildid)
        return guild ? guild.name : "Unknown server: "+guildid
    });
    if (guilds.length > 5) {
        const total = guilds.length
        guilds = guilds.splice(0,4);
        guilds.push(`and ${total - 5} more...`);
    } 
    embed.addField(`Account connected in ${userData.servers.length} server(s)`, guilds.join(", ") || "None");

    return embed;
}

const modTotal = (allMods) => {
    let downloads = 0;
    allMods.forEach(m => m.unique_downloads ? downloads += m.unique_downloads : null );
    return downloads;
}

// USER MOD FUNCTIONS

exports.getModsbyUser = async (userId) => {
    return new Promise( (resolve, reject) => {
        pool.query('SELECT * FROM user_mods WHERE owner = $1', [userId],
        (error, results) => {
            if (error) { console.log(error); return resolve([]) };
            return resolve(results.rows);
        });
    })
}

exports.createMod = async (newMod) => {
    return new Promise( (resolve, reject) => {
        pool.query('INSERT INTO user_mods (domain, mod_id, name, game, unique_downloads, total_downloads, path, owner) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
        [newMod.domain, newMod.mod_id, newMod.name, newMod.game, newMod.unique_downloads, newMod.total_downloads, newMod.path, newMod.owner],
        (error, results) => {
            if (error) {
                console.log(error);
                return reject(error);
            }
            resolve(true);
        })
    });

}

exports.deleteMod = async (mod) => {
    return new Promise( (resolve,reject) => {
        pool.query('DELETE FROM user_mods WHERE mod_id = $1 AND domain = $2', [mod.mod_id, mod.domain],
        (error, results) => {
            if (error) console.log(error); reject(error);
            resolve(true);
        })
    });
}

exports.updateMod = async (mod, newData) => {
    return new Promise( (resolve,reject) => {
        Object.keys(newUser).forEach((key) => {
            pool.query(`UPDATE users SET ${key} = $1 WHERE mod_id = $2 AND domain = $3`, [newData[key], mod.mod_id, mod.domain], (error, results) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

// USER ROLE FUNCTIONS

exports.updateAllRoles = async (userData, message, client) => {
    return new Promise(async (resolve, reject) => {
        try {
            const servers = await exports.getAllServers();
            let newServers = userData.servers;

            for (server of servers) {
                const guild = client.guilds.find(s => s.id === server.id);
                const member = guild ? guild.members.find(m => m.id === userData.d_id) : undefined;
                // If the guild is not found.
                if (!member || !guild) continue;

                // If this server is not registered, add it to the list. 
                if (newServers.indexOf(guild.id) === -1) newServers.push(guild.id);

                const botMember = guild.members.find(m => m.id === client.user.id);
                if (!botMember.hasPermission('MANAGE_ROLES')) {
                    console.log(`${new Date().toLocaleString()} - Permissions in ${guild.name} do not allow role assignment.`);
                    continue;
                }


                let rolesToAdd = [];
                
                // Get the roles
                const premiumRole = server.role_premium ? guild.roles.find(r => r.id === server.role_premium) : undefined;
                const supporterRole = server.role_supporter ? guild.roles.find(r => r.id === server.role_premium) : undefined;
                const linkedRole = server.role_linked ? guild.roles.find(r => r.id === server.role_supporter) : undefined;
                const modAuthorRole = server.role_author ? guild.roles.find(r => r.id === server.role_supporter) : undefined;
                const modAuthorDownloads = server.author_min_downloads || 1000;

                // Get the unique download total for mods - TODO!
                const allUserMods = [];
                
                // Assign linked role.
                if (linkedRole && !member.roles.has(linkedRole)) rolesToAdd.push(linkedRole.id);

                // Assign mod author role.
                if (modAuthorRole && modTotal(allUserMods) >= modAuthorDownloads && !member.roles.has(modAuthorRole)) {
                    rolesToAdd.push(modAuthorRole.id);
                    member.send(`Congratulations! You are now a recognised mod author in ${guild.name}!`);
                };

                // Assign membership role
                if (userData.premium && premiumRole && !member.roles.has(premiumRole))  rolesToAdd.push(server.role_premium)
                else if (userData.supporter && supporterRole && !member.roles.has(supporterRole)) rolesToAdd.push(server.role_premium);

                member.addRoles(rolesToAdd, 'Nexus Mods Discord link')
                .then(() => console.log(`${new Date().toLocaleString()} - Updated roles for ${userData.name} (${member.user.tag}) in ${guild.name}`))
                .catch(err => console.error(`${new Date().toLocaleString()} - Failed to update roles for ${userData.name} in ${guild.name}`, err));

            }

            if (newServers !== userData.servers) {
                // Update any servers not on our profile card.
                await exports.updateUser(userData.d_id, {servers: newServers});
            }

            resolve();
        }
        catch(err) {
            console.log('Error updating user roles', err);
            reject('Error updating user roles \n'+ err);
        }
        
    });

}

exports.updateRoles = async (userData, guild, bRemove = false) => {
    return new Promise(async (resolve, reject) => {
        const guildMember = await guild.members.find(m => m.id === userData.discordId);
        const guildData = await exports.getServer(guild);
        if (!guildData) return reject('No guild data for '+guild.name);

        // Check we can actually assign roles.
        const botMember = guild.members.find(client.user);
        if (!botMember.hasPermission('MANAGE_ROLES')) {
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
            member.removeRoles(allRoles.filter(r => r !== ''), 'Nexus Mods Discord unlink')
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

        if (rolesToAdd.length) member.addRoles(rolesToAdd, 'Nexus Mods Discord link')
            .catch(err => console.log(`${new Date().toLocaleString()} - Could not add roles to ${userData.name} in ${guild.name}`, err));
        
        return resolve(true);


    });
}

// SERVER MANAGEMENT FUNCTIONS

exports.getAllServers = () => {
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM servers', (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        })

    });
}

exports.getServer = (guild) => {
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM servers WHERE id = $1', [guild.id], (error, result) => {
            if (error) return reject(error);
            if (!result.rows || result.rows.length === 0) {
                console.log("Guild not found: "+guild.name);
                resolve(false);
            }
            else {
                resolve(result.rows[0]);
            }
        })

    });
}

exports.addServer = (guild) => {
    return new Promise((resolve, reject) => {
        pool.query('INSERT INTO servers (id, server_owner) VALUES ($1, $2)', [guild.id, guild.owner.id], (error, results) => {
            if (error) return reject(error);
            console.log(new Date().toLocaleString() + " - Added server to database: "+guild.name);
            resolve(true);
        })
    })
}

exports.updateServer = (guildId, newData) => {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        Object.keys(newData).forEach((key) => {
            pool.query(`UPDATE servers SET ${key} = $1 WHERE id = $2`, [newData[key], guildId], (error, results) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

exports.deleteServer = (guildId) => {
    return new Promise((resolve, reject) => {
        pool.query('DELETE FROM servers WHERE id = $1', [guildId], (error, results) => {
            if (error) {
                //throw error;
                reject(false);
            };
            resolve(true);
        });
    });
}

// Read and write latest news post

exports.getSavedNews = () => {
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM news', [], (error, results) => {
            if (error) reject(error);
            resolve(results.rows[0]);
        });
    });
}

exports.updateSavedNews = (newsArticle) => {
    return new Promise((resolve, reject) => {
        pool.query('DELETE FROM news', [], (error, results) => {
            if (error) return reject(error);
            pool.query('INSERT INTO news (title, date) VALUES ($1, $2)', [newsArticle.title, newsArticle.date], (error, results) => {
                if (error) return reject(error);
                resolve(true);
            });
        })
    });
}

// GAME FEED MANAGEMENT

exports.getAllGameFeeds = () => {
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM game_feeds', (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

exports.getGameFeed = (feedId) => {
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM game_feeds WHERE _id = $1', [feedId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

exports.getGameFeedsForServer = (serverId) => {
    return new Promise((resolve, reject) => {
        pool.query('SELECT * FROM game_feeds WHERE guild = $1', [serverId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

exports.createGameFeed = (newFeed) => {
    return new Promise(
        (resolve, reject) => {
        pool.query('INSERT INTO game_feeds (channel, guild, owner, domain, title, nsfw, sfw, show_new, show_updates, last_timestamp, created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [newFeed.channel, newFeed.guild, newFeed.owner, newFeed.domain, newFeed.title, newFeed.nsfw, newFeed.sfw, newFeed.show_new, newFeed.show_updates, Date(0), new Date()], 
        (error, results) => {
            if (error) {
                //throw error;
                console.log(error);
                if (error.code === "23505") return reject(`Error ${error.code} - The field ${error.constraint} is not unique.`);
            };
            resolve(true);
        })
    });
}

exports.updateGameFeed = (feedId, newData) => {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        Object.keys(newData).forEach((key) => {
            pool.query(`UPDATE game_feeds SET ${key} = $1 WHERE _id = $2`, [newUser[key], feedId], (error, results) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

exports.deleteGameFeed = (feedId) => {
    return new Promise((resolve, reject) => {
        pool.query('DELETE FROM game_feeds WHERE _id = $1', [feedId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}