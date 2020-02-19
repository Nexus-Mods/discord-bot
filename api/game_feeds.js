const { query } = require('./bot-db.js');

const getAllGameFeeds = () => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM game_feeds', (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

const getGameFeed = (feedId) => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM game_feeds WHERE _id = $1', [feedId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

const getGameFeedsForServer = (serverId) => {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM game_feeds WHERE guild = $1', [serverId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

const createGameFeed = (newFeed) => {
    return new Promise(
        (resolve, reject) => {
        query('INSERT INTO game_feeds (channel, guild, owner, domain, title, nsfw, sfw, show_new, show_updates, last_timestamp, created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
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

const updateGameFeed = (feedId, newData) => {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        Object.keys(newData).forEach((key) => {
            query(`UPDATE game_feeds SET ${key} = $1 WHERE _id = $2`, [newUser[key], feedId], (error, results) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

const deleteGameFeed = (feedId) => {
    return new Promise((resolve, reject) => {
        query('DELETE FROM game_feeds WHERE _id = $1', [feedId], (error, result) => {
            if (error) return reject(error);
            resolve(result.rows);
        });
    });
}

module.exports = { getAllGameFeeds, getGameFeed, getGameFeedsForServer, createGameFeed, updateGameFeed, deleteGameFeed };