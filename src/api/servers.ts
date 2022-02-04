import query from '../api/dbConnect';
import { QueryResult } from 'pg';
import { BotServer } from '../types/servers';
import { Guild } from 'discord.js';
import { logMessage } from './util';

async function getAllServers(): Promise<BotServer[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM servers', [], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            resolve(result?.rows || []);
        })

    });
}

async function getServer(guild: Guild): Promise<BotServer> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM servers WHERE id = $1', [guild.id], 
        async (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            if (!result?.rows || result.rows.length === 0) {
                logMessage('Server lookup. Guild not found: ', guild.name);
                try {
                    await addServer(guild);
                    const newResult = await getServer(guild);
                    return resolve(newResult);
                }
                catch(err) {
                    return reject('Not found and could not be created.');
                }
            }
            else {
                return resolve(result.rows[0]);
            }
        })

    });
}

async function addServer(guild: Guild): Promise<boolean> {
    const owner = await guild.fetchOwner();
    return new Promise((resolve, reject) => {
        query('INSERT INTO servers (id, server_owner) VALUES ($1, $2)', [guild.id, owner?.id], 
        (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            console.log(new Date().toLocaleString() + " - Added server to database: "+guild.name);
            resolve(true);
        })
    })
}

async function updateServer (guildId: string, newData: any): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        Object.keys(newData).forEach((key) => {
            query(`UPDATE servers SET ${key} = $1 WHERE id = $2`, [newData[key], guildId], 
            (error: Error, result?: QueryResult) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

async function deleteServer(guildId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        query('DELETE FROM servers WHERE id = $1', [guildId], 
        (error: Error, result?: QueryResult) => {
            if (error) {
                //throw error;
                reject(false);
            };
            resolve(true);
        });
    });
}

export { getAllServers, getServer, addServer, updateServer, deleteServer };