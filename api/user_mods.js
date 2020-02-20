const { query } = require('./dbConnect.js');

const getModsbyUser = async (userId) => {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM user_mods WHERE owner = $1', [userId],
        (error, results) => {
            if (error) { console.log(error); return resolve([]) };
            return resolve(results.rows);
        });
    })
}

const createMod = async (newMod) => {
    return new Promise( (resolve, reject) => {
        query('INSERT INTO user_mods (domain, mod_id, name, game, unique_downloads, total_downloads, path, owner) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
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

const deleteMod = async (mod) => {
    return new Promise( (resolve,reject) => {
        query('DELETE FROM user_mods WHERE mod_id = $1 AND domain = $2', [mod.mod_id, mod.domain],
        (error, results) => {
            if (error) {
                console.log(error);
                return reject(error);
            }
            resolve(true);
        })
    });
}

const updateMod = async (mod, newData) => {
    return new Promise( (resolve,reject) => {
        Object.keys(newUser).forEach((key) => {
            query(`UPDATE users SET ${key} = $1 WHERE mod_id = $2 AND domain = $3`, [newData[key], mod.mod_id, mod.domain], (error, results) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

module.exports = { getModsbyUser, createMod, deleteMod, updateMod };