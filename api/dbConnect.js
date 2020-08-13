require("dotenv").config();
const Pool = require('pg').Pool;
const config = {
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: process.env.PORT,
    ssl: {
        rejectUnauthorized: false,
    },
}
const pool = new Pool(config);

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