import { queryPromise } from '../api/dbConnect';
import { logMessage } from '../api/util';

const tableTypes = (create?: boolean) => ({
    'd_id': create? 'character varying NOT NULL' : 'character varying',
    'id': create ? 'integer NOT NULL' : 'integer',
    'name': create ? 'character varying NOT NULL' : 'character varying',
    'avatar_url': 'character varying',
    'apikey': 'character varying',
    'supporter': create ? 'boolean NOT NULL DEFAULT FALSE': 'boolean',
    'premium': create ? 'boolean NOT NULL DEFAULT FALSE': 'boolean',
    'modauthor': create ? 'boolean NOT NULL DEFAULT FALSE': 'boolean',
    'nexus_access': 'character varying',
    'nexus_refresh': 'character varying',
    'nexus_expires': 'bigint',
    'discord_access': 'character varying',
    'discord_refresh': 'character varying',
    'discord_expires': 'bigint',
    'lastupdate': create ? 'timestamp with time zone NOT NULL' : 'timestamp with time zone'
});

const createConstraints = 'CONSTRAINT "API Key" UNIQUE (apikey), CONSTRAINT "Discord ID " UNIQUE (d_id), CONSTRAINT "Nexus Mods ID" UNIQUE (id)';

async function userSetup() {

    const createQuery = `CREATE TABLE IF NOT EXISTS public.users (${Object.entries(tableTypes(true)).map(m => m.join(' ')).join(', ')}, ${createConstraints})`;

    try {
        await queryPromise(createQuery, []);
    }
    catch(err) {
        logMessage('Error Creating users table', err, true);
        (err as Error).message = 'Error Creating users table: '+(err as Error).message;
        throw err;
    }

    try {
        const columnsQuery = await queryPromise('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1', ['users']);
        const columns = convertToObject(columnsQuery.rows);
        await compareColumns('users', columns, tableTypes());
    }
    catch(err) {
        logMessage('Error in column query', err, true);
    }

    process.exit(1);
    
}

async function compareColumns(tableName: string, database: { [key: string]: string }, ref: { [key: string]: string }) {
    const areSame = (db: { [key: string]: string }, ref: { [key: string]: string }): boolean => {
        const refKeys = Object.keys(ref).sort();
        const dbKeys = Object.keys(db).sort();
        if (refKeys.join('.') != dbKeys.join('.')) {
            logMessage('Column names mismatch', { refKeys, dbKeys });
            return false;
        }
        return refKeys.reduce((prev, cur) => {
            if (prev === false) return prev;
            if (db[cur] !== ref[cur]) prev = false;
            return prev;
        }, true);
    }

    const match: boolean = areSame(database, ref);
    if (!match) {
        // logMessage('No match on columns', { tableName, database, ref });
        const missingColumns = Object.keys(ref).filter(k => !Object.keys(database).includes(k));
        const extraColumns = Object.keys(database).filter(k => !Object.keys(ref).includes(k));
        logMessage('Columns check', { missingColumns, extraColumns, tableName });
        // Add missing columns
        const columnsToAdd = missingColumns.map(c => `ADD COLUMN ${c} ${ref[c]}`);
        if (columnsToAdd.length) await queryPromise(`ALTER TABLE public.${tableName} ${columnsToAdd.join(', ')}`, []);
        // Delete extra columns
        if (extraColumns.length) await queryPromise(`ALTER TABLE public.${tableName} ${extraColumns.map(c => `DROP COLUMN ${c}`).join(', ')}`, []);

    }
    else logMessage('Database table structure matches template', tableName);
}

function convertToObject(columns: { column_name: string, data_type: string }[]) {
    const result = columns.reduce((prev: any, cur) => {
        prev[cur.column_name] = cur.data_type;
        return prev;
    }, {});
    return result;
}

export default userSetup