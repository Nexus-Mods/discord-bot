import { Pool, PoolConfig, PoolClient, QueryResult } from 'pg';
import path from 'path';
import { logMessage } from './util';
const config = require(path.join('..', 'config.json'));
const poolConfig: PoolConfig = {
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: process.env.PORT ? parseInt(process.env.PORT) : 0,
    ssl: !config.testing ? {
        rejectUnauthorized: false,
    } : false,
    statement_timeout: 5000
};

const pool = new Pool(poolConfig);

async function queryPromise(query: string, values: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
        pool.connect((err: Error, client: PoolClient, release) => {
            if (err) {
                logMessage('Error acquiring client', { query, err: err.message }, true);
                return reject(err);
            };
            client.query(query, values, (err: Error, result: QueryResult) => {
                if (err) {
                    logMessage('Error in query', { query, values, err }, true);
                    return reject(err);
                }
                return resolve(result);
            })

        })

    });
}

function doQuery(query: string, values: any[], callback: (err: Error, result?: QueryResult) => void) {
    pool.connect((err: Error, client: PoolClient, release) => {
        if (err) {
            logMessage('Error acquiring client', { query, err: err.message, poolConfig }, true);
            release();
            return callback(err);
        };
        client.query(query, values, (err: Error, result: QueryResult) => {
            release();
            if (err) {
                logMessage('Error in query', { query, values, err }, true);
                return callback(err);
            };
            if (callback) callback(err, result);
            else console.warn('Callback undefined in query', query, values);
        });

    });    
}

export default doQuery;