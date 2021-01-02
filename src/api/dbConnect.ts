import { Pool, PoolConfig, PoolClient, QueryResult } from 'pg';
const config = require("../config.json");
const poolConfig: PoolConfig = {
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: process.env.PORT ? parseInt(process.env.PORT) : 0,
    ssl: !config.testing ? {
        rejectUnauthorized: false,
    } : false,
};

const pool = new Pool(poolConfig);

function doQuery(query: string, values: any[], callback: (err: Error, result?: QueryResult) => void) {
    pool.connect((err: Error, client: PoolClient, release) => {
        if (err) {
            console.error('Error acquiring client', query, err.message);
            release();
            return callback(err);
        };
        client.query(query, values, (err: Error, result: QueryResult) => {
            release();
            if (err) {
                console.error('Error in query', query, values, err);
                return callback(err);
            };
            if (callback) callback(err, result);
            else console.warn('Callback undefined in query', query, values);
        });

    });    
}

export default doQuery;