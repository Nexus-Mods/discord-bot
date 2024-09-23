import query from './dbConnect';
import { QueryResult } from 'pg';
import { IAutomodRule } from "../types/util";

async function getAutomodRules(): Promise<IAutomodRule[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM automod_rules ORDER BY id ASC', [], 
        (error: Error, results?: QueryResult) => {
            if (error) reject(error);
            resolve(results?.rows || []);
        });
    });
}

async function createAutomodRule(type: 'low' | 'high', filter: string, reason: string): Promise<number> {
    return new Promise((resolve, reject) => {
        query('INSERT INTO automod_rules (type, filter, reason) VALUES ($1, $2, $3) RETURNING id', [type, filter, reason], 
        (error, results?: QueryResult) => {
            if (error) reject(error);
            resolve(results?.rows[0].id)
        })
    })
}

async function deleteAutomodRule(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
        query('DELETE FROM automod_rules WHERE id=$1', [id], 
        (error, results?: QueryResult) => {
            if (error) reject(error);
            resolve()
        })
    })
}

export { getAutomodRules, createAutomodRule, deleteAutomodRule };