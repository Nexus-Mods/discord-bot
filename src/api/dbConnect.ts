import pg, { PoolConfig, PoolClient, QueryResult, QueryResultRow } from 'pg';
// Aliased: pg exports a DatabaseError too, and ours is the one that gets thrown.
const { Pool, DatabaseError: PgDatabaseError } = pg;
import { logger } from './logger.js';
import { DatabaseError, toError } from './errors.js';
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === undefined;

export const poolConfig: PoolConfig = {
    user: process.env.DBUSER,
    password: process.env.DBPASS || '',
    host: process.env.HOST,
    database: process.env.DATABASE,
    port: process.env.PORT ? parseInt(process.env.PORT) : 0,
    ssl: isProduction 
        ? { rejectUnauthorized: false } 
        : false,
    // statement_timeout: 10000,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 2000,
    max: 10
};

const pool = new Pool(poolConfig);


const automodPool = new Pool({...poolConfig, database: process.env.AUTOMOD_DATABASE});

export async function queryPromise<T extends QueryResultRow>(query: string, values?: any[], name?: string): Promise<QueryResult<T>> {
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
        // values are deliberately not logged: for the users table they contain OAuth tokens.
        else logger.error('Error in query', { query, valueCount: values?.length ?? 0, err });
        throw handleDatabaseError(err);
    }
    finally {
        client?.release()
    }
}

export async function queryAutoMod<T extends QueryResultRow>(query: string, values?: any[], name?: string): Promise<QueryResult<T>> {
    let client: PoolClient | undefined = undefined;
    
    try {
        client = await automodPool.connect();
        const result = await client.query<T>({
            text: query,
            values,
            name,            
        });
        return result;
        
    }
    catch(err) {
        if (!client) logger.error('Error acquiring Automod client', { query, err: (err as Error).message });
        else logger.error('Error in Automod query', { query, valueCount: values?.length ?? 0, err });
        throw handleDatabaseError(err);
    }
    finally {
        client?.release()
    }
}

/**
 * Turn a pg failure into a DatabaseError.
 *
 * This used to be typed `: string` and every caller did `throw handleDatabaseError(err)`,
 * so the data layer threw bare strings. They carried no stack, and every downstream
 * `(err as Error).message` was undefined. The user-facing text is now carried on the
 * error as userMessage instead of being the thrown value.
 */
function handleDatabaseError(error: unknown): DatabaseError {
    const err = toError(error);
    const code = (error as { code?: string })?.code;
    const detail = (error as { detail?: string })?.detail;

    if (error instanceof PgDatabaseError) {
        const known: Record<string, string> = {
            '23505': 'Duplicate record found. Please try again.',
            '23503': 'Invalid reference. Please check your data.',
            '22001': 'Input value is too long. Please shorten the text.',
            '42601': 'An unexpected error occurred (Syntax error). Please try again later.',
            '42703': 'An unexpected error occurred (Undefined column). Please try again later.',
        };
        const userMessage = known[code ?? ''] ?? `An unexpected database error occurred (${code}). Please try again later.`;
        return new DatabaseError(`Database error ${code}${detail ? ': ' + detail : ''}`, {
            cause: err,
            userMessage,
            context: { code, detail },
        });
    }

    if (err.message === 'The server does not support SSL connections') {
        return new DatabaseError('Database rejected the SSL connection', {
            cause: err,
            isOperational: false,
            userMessage: 'SSL connection error. Please report this issue as it is a problem with the database settings.',
        });
    }
    if (err.message.includes('no pg_hba.conf entry for host')) {
        return new DatabaseError('Database refused the connection (pg_hba.conf)', {
            cause: err,
            isOperational: false,
            userMessage: 'Database connection error: Access denied. Please report this issue as it is a problem with the database settings.',
        });
    }
    if (err.message.includes('timeout exceeded when trying to connect')) {
        return new DatabaseError('Database connection timed out', {
            cause: err,
            userMessage: 'Database connection timed out.',
        });
    }

    return new DatabaseError('Unhandled database error', { cause: err, isOperational: false });
}

export default queryPromise;