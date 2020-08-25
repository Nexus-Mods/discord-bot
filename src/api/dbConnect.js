require("dotenv").config();
const config = require("../config.json");
const Pool = require('pg').Pool;
const poolConfig = {
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: process.env.PORT,
    ssl: !config.testing ? {
        rejectUnauthorized: false,
    } : false,
}
const pool = new Pool(poolConfig);

function doQuery(text, values, callback) {
    pool.connect((err, client, release) => {
        if (err) return console.error('Error acquiring client', text, err.stack);
        client.query(text, values, (err, result) => {
            if (err) console.error('Error in query', text, values, err.stack);
            release();
            if (callback) callback(err, result);
            else console.warn('Callback undefined in query', text);
        })
    })
}

module.exports = { pool , query: doQuery };