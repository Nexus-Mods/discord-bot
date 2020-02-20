const { query } = require('./dbConnect.js');
const { updateRoles } = require('./users.js');

const getLinksByUser = (userId) => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM user_servers WHERE user_id = $1', [userId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });

    });
}

const addServerLink = async (user, server) => {
    if (typeof(user.id) !== "number") throw new Error(`Invalid member ID. ${user.id} for ${user}.`);
    if (typeof(server.id) !== "string") throw new Error(`Invalid member ID. ${server.id} for ${server.name}.`);

    return new Promise((resolve, reject) => {
        query('INSERT INTO user_servers (user_id, server_id) VALUES ($1, $2)', [user.id, server.id], async (error, result) => {
            if (error) return reject(error);
            await updateRoles(user, server);
            resolve();
        });
    });
}

const deleteServerLink = (userId, serverId) => {
    return new Promise((resolve, reject) => {
        query('DELETE FROM user_servers WHERE user_id = $1 AND server_id = $2', [userId, serverId], (error, result) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

const deleteAllServerLinksByUser = (userId) => {
    return new Promise((resolve, reject) => {
        query('DELETE FROM user_servers WHERE user_id = $1', [userId], (error, result) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

module.exports = { getLinksByUser, addServerLink, deleteServerLink, deleteAllServerLinksByUser };