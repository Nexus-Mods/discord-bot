import pg, { PoolConfig, PoolClient, QueryResult, QueryResultRow } from 'pg';
const { Pool } = pg;
import { logMessage } from './util';
import rawConfig from '../../config.json' assert { type: 'json' };
const config: { testing?: boolean } = rawConfig;
import dotenv from 'dotenv';
dotenv.config();

const poolConfig: PoolConfig = {
    user: process.env.DBUSER,
    password: process.env.DBPASS || '',
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: process.env.PORT ? parseInt(process.env.PORT) : 0,
    ssl: config?.testing === false ? {
        rejectUnauthorized: false,
    } : false,
    statement_timeout: 5000,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 3000,
    max: 10
};

const pool = new Pool(poolConfig);

export async function queryPromise<T extends QueryResultRow>(query: string, values: any[], name?: string): Promise<QueryResult<T>> {
    let client: PoolClient | undefined = undefined;
    
    try {
        client = await pool.connect();
        const result = await client.query<T>({
            text: query,
            values,
            name,            
        });
        return result;
        
    }
    catch(err) {
        if (!client) logMessage('Error acquiring client', { query, err: (err as Error).message }, true);
        else logMessage('Error in query', { query, values, err }, true);
        throw err;
    }
    finally {
        client?.release()
    }
}

export default queryPromise;