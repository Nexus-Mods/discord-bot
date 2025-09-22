import query from './dbConnect';
import { IAutomodRule, IBadFileRule } from "../types/util";

async function getAutomodRules(): Promise<IAutomodRule[]> {
    try {
        const result = await query<IAutomodRule>('SELECT * FROM automod_rules ORDER BY id ASC', [], 'GetAutomodRules');
        return result.rows;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function createAutomodRule(type: 'low' | 'high', filter: string, reason: string): Promise<number> {
    try {
        const result = await query<{ id: number }>('INSERT INTO automod_rules (type, filter, reason) VALUES ($1, $2, $3) RETURNING id', [type, filter, reason], 'CreateAutomodRule');
        return result.rows[0].id;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function deleteAutomodRule(id: number): Promise<void> {
    try {
        await query('DELETE FROM automod_rules WHERE id=$1', [id], 'DeleteAutomodRule');
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getBadFiles(): Promise<IBadFileRule[]> {
    try {
        const result = await query<IBadFileRule>('SELECT * FROM automod_badfiles ORDER BY id ASC', [], 'GetBadFiles');
        return result.rows;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function addBadFile(type: 'low' | 'high', func: string, test: string, flagMessage: string): Promise<number> {
    try {
        const result = await query<{ id: number }>('INSERT INTO automod_badfiles (type, test, "flagMessage", "funcName") VALUES ($1, $2, $3, $4) RETURNING id', 
            [type, test.toLowerCase(), flagMessage, func], 'AddBadFile');
        return result.rows[0].id;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function deleteBadFile(id: number): Promise<void> {
    try {
        await query('DELETE FROM automod_badfiles WHERE id=$1', [id], 'DeleteBadFile');
    } catch (error) {
        return Promise.reject(error);
    }
}

export { getAutomodRules, createAutomodRule, deleteAutomodRule, getBadFiles, addBadFile, deleteBadFile };
