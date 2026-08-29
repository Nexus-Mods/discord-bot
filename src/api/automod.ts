import query from './dbConnect.js';
import type { IAutomodRule, IBadFileRule } from "../types/util.js";

// query() throws a DatabaseError with its cause attached, so the try/catch blocks
// that only did `return Promise.reject(error)` have been removed.

async function getAutomodRules(): Promise<IAutomodRule[]> {
    const result = await query<IAutomodRule>('SELECT * FROM automod_rules ORDER BY id ASC', [], 'GetAutomodRules');
    return result.rows;
}

async function createAutomodRule(type: 'low' | 'high', filter: string, reason: string): Promise<number> {
    const result = await query<{ id: number }>(
        'INSERT INTO automod_rules (type, filter, reason) VALUES ($1, $2, $3) RETURNING id',
        [type, filter, reason],
        'CreateAutomodRule',
    );
    return result.rows[0].id;
}

async function deleteAutomodRule(id: number): Promise<void> {
    await query('DELETE FROM automod_rules WHERE id=$1', [id], 'DeleteAutomodRule');
}

async function getBadFiles(): Promise<IBadFileRule[]> {
    const result = await query<IBadFileRule>('SELECT * FROM automod_badfiles ORDER BY id ASC', [], 'GetBadFiles');
    return result.rows;
}

async function addBadFile(type: 'low' | 'high', func: string, test: string, flagMessage: string): Promise<number> {
    const result = await query<{ id: number }>(
        'INSERT INTO automod_badfiles (type, test, "flagMessage", "funcName") VALUES ($1, $2, $3, $4) RETURNING id',
        [type, test.toLowerCase(), flagMessage, func],
        'AddBadFile',
    );
    return result.rows[0].id;
}

async function deleteBadFile(id: number): Promise<void> {
    await query('DELETE FROM automod_badfiles WHERE id=$1', [id], 'DeleteBadFile');
}

export { getAutomodRules, createAutomodRule, deleteAutomodRule, getBadFiles, addBadFile, deleteBadFile };
