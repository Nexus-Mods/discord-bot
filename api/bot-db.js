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

exports.userEmbed = (userData, message, client) => {
    const discordUser = client.users.find(u => u.id === userData.d_id);
    let embed = new Discord.RichEmbed()
    .setAuthor("Member Search Results", discordUser.avatarURL)
    .addField("Nexus Mods", `[${userData.name}](https://nexusmods.com/users/${userData.id})\n${userData.premium ? "Premium Member" : userData.Supporter ? "Supporter" : "Member"}`, true)
    .addField("Discord", `${discordUser}\n${discordUser.tag}`, true)
    .setColor(0xda8e35)
    .setThumbnail(userData.avatar_url ? userData.avatar_url : client.user.avatarURL)
    .setTimestamp(userData.lastupdate)
    .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);
    if (userData.mods && userData.mods.length) {
        let modData = userData.mods.map( mod => `[${mod.name}](${mod.url}) - ${mod.game}`);
        if (modData.length > 5) modData = modData.slice(0,4); //Only show a maximum of 5.
        embed.addField(`My Mods - ${userData.moddownloads.toLocaleString()} downloads for ${userData.mods.length} mod(s).`, `${modData.join("\n")}\n-----\n[**See all of ${userData.name}'s content at Nexus Mods.**](https://www.nexusmods.com/users/${userData.id}?tab=user+files)`)
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
        pool.query('INSERT INTO servers (id) VALUES ($1)', [guild.id], (error, results) => {
            if (error) return reject(error);
            console.log("Added guild: "+guild.name);
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
        pool.query('DELETE * FROM news', [], (error, results) => {
            if (error) return reject(error);
        })
        .then( () => {
                pool.query('INSERT INTO news (title, date) VALUES ($1, $2)', [newsArticle.title, newsArticle.date], (error, results) => {
                    if (error) return reject(error);
                    resolve(true);
                });
            });
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
            //console.log("User inserted into the database: "+user.nexusName);
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