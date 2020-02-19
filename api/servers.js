const { query } = require('./dbConnect.js');

const getAllServers = () => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM servers', [], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        })

    });
}

const getServer = (guild) => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM servers WHERE id = $1', [guild.id], (error, result) => {
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

const addServer = (guild) => {
    return new Promise((resolve, reject) => {
        query('INSERT INTO servers (id, server_owner) VALUES ($1, $2)', [guild.id, guild.owner.id], (error, results) => {
            if (error) return reject(error);
            console.log(new Date().toLocaleString() + " - Added server to database: "+guild.name);
            resolve(true);
        })
    })
}

const updateServer = (guildId, newData) => {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        Object.keys(newData).forEach((key) => {
            query(`UPDATE servers SET ${key} = $1 WHERE id = $2`, [newData[key], guildId], (error, results) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

const deleteServer = (guildId) => {
    return new Promise((resolve, reject) => {
        query('DELETE FROM servers WHERE id = $1', [guildId], (error, results) => {
            if (error) {
                //throw error;
                reject(false);
            };
            resolve(true);
        });
    });
}

module.exports = { getAllServers, getServer, addServer, updateServer, deleteServer };