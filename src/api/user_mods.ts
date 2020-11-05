import query from '../api/dbConnect';
import { QueryResult } from 'pg';
import { NexusLinkedMod } from '../types/users';

async function getModsbyUser(userId: number): Promise<NexusLinkedMod[]> {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM user_mods WHERE owner = $1', [userId],
        (error: Error, result: QueryResult) => {
            if (error) { console.log(error); return resolve([]) };
            return resolve(result.rows);
        });
    })
}

async function createMod(newMod: NexusLinkedMod): Promise<boolean> {
    return new Promise( (resolve, reject) => {
        query('INSERT INTO user_mods (domain, mod_id, name, game, unique_downloads, total_downloads, path, owner) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
        [newMod.domain, newMod.mod_id, newMod.name, newMod.game, newMod.unique_downloads, newMod.total_downloads, newMod.path, newMod.owner],
        (error: Error, result: QueryResult) => {
            if (error) {
                console.log(error);
                return reject(error);
            }
            resolve(true);
        })
    });

}

async function deleteMod(mod: NexusLinkedMod): Promise<boolean> {
    return new Promise( (resolve,reject) => {
        query('DELETE FROM user_mods WHERE mod_id = $1 AND domain = $2', [mod.mod_id, mod.domain],
        (error: Error, result: QueryResult) => {
            if (error) {
                console.log(error);
                return reject(error);
            }
            resolve(true);
        })
    });
}

async function updateMod(mod: NexusLinkedMod, newData: any): Promise<boolean> {
    let errors = 0;
    return new Promise( (resolve,reject) => {
        Object.keys(newData).forEach((key) => {
            query(`UPDATE user_mods SET ${key} = $1 WHERE mod_id = $2 AND domain = $3`, [newData[key], mod.mod_id, mod.domain], (error: Error, result: QueryResult) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

export { getModsbyUser, createMod, deleteMod, updateMod };