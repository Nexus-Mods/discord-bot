const { query } = require('./dbConnect.js');
const { getModsbyUser } = require('./user_mods.js');
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

module.exports = { getAllUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed };