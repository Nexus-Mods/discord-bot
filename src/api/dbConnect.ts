import pg, { PoolConfig, PoolClient, QueryResult, QueryResultRow } from 'pg';
const { Pool, DatabaseError } = pg;
import { logger } from '../DiscordBot';
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === undefined;

const poolConfig: PoolConfig = {
    user: process.env.DBUSER,
    password: process.env.DBPASS || '',
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: process.env.PORT ? parseInt(process.env.PORT) : 0,
    ssl: isProduction 
        ? { rejectUnauthorized: false } 
        : false,
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
        if (!client) logger.error('Error acquiring client', { query, err: (err as Error).message });
        else logger.error('Error in query', { query, values, err });
        throw handleDatabaseError(err);
    }
    finally {
        client?.release()
    }
}

export function handleDatabaseError(error: Error | any): string {
    if (error instanceof DatabaseError) {
        logger.debug('Database error', { error });
        switch (error.code) {
            case '23505': // Unique violation
              logger.error('Database error - Duplicate entry:', error.detail);
              return 'Duplicate record found. Please try again.';
            case '23503': // Foreign key violation
              logger.error('Database error - Foreign key violation:', error.detail);
              return 'Invalid reference. Please check your data.';
            case '22001': // String data too long
              logger.error('Database error - Value too long:', error.detail);
              return 'Input value is too long. Please shorten the text.';
            case '42601': // Syntax error in SQL
              logger.error('Database error - Syntax error:', error.detail);
              return 'An unexpected error occurred. Please try again later.';
            case '42703': // Undefined column
              logger.error('Database error - Undefined column:', error.detail);
              return 'An unexpected error occurred. Please try again later.';
            default:
              logger.error(`Unhandled database error [${error.code}]:`, error.message);
              return 'An unexpected error occurred. Please try again later.';
          }
    } else if (error.message === 'The server does not support SSL connections') { 
        return 'SSL connection error. Please report this issue as it is a problem with the database settings.';
    } else if (error.message.includes('no pg_hba.conf entry for host')) {
        logger.error('Database connection error - pg_hba.conf issue:', error.message);
        return 'Database connection error: Access denied. Please report this issue as it is a problem with the database settings.';
    } else if (error.message.includes('timeout exceeded when trying to connect')) {
        logger.error('Database connection timed out.', { error });
        return 'Database connection timed out.'
    } else {
        logger.error('Unknown error', { message: error.message, code: error.code, error });
        return 'An unknown error occurred. Please try again later.';
    }
}

export default queryPromise;