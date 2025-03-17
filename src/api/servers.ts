import query from '../api/dbConnect';
import { BotServer } from '../types/servers';
import { Guild } from 'discord.js';
import { logMessage } from './util';

async function getAllServers(): Promise<BotServer[]> {
    try {
        const result = await query<BotServer>('SELECT * FROM servers', [], 'GetAllServers');
        return result.rows;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getServer(guild: Guild): Promise<BotServer> {
    try {
        const result = await query<BotServer>('SELECT * FROM servers WHERE id = $1', [guild.id], 'GetServer');
        if (!result?.rows || result.rows.length === 0) {
            logMessage('Server lookup. Guild not found: ', guild.name);
            try {
                await addServer(guild);
                const newResult = await getServer(guild);
                return newResult;
            } catch (err) {
                return Promise.reject('Not found and could not be created.');
            }
        }
        return result.rows[0];
    } catch (error) {
        return Promise.reject(error);
    }
}

async function addServer(guild: Guild): Promise<boolean> {
    const owner = await guild.fetchOwner();
    try {
        await query('INSERT INTO servers (id, server_owner) VALUES ($1, $2)', [guild.id, owner?.id], 'AddServer');
        console.log(new Date().toLocaleString() + " - Added server to database: " + guild.name);
        return true;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function updateServer(guildId: string, newData: any): Promise<boolean> {
    try {
        let errors = 0;
        await Promise.all(Object.keys(newData).map((key) => 
            query(`UPDATE servers SET ${key} = $1 WHERE id = $2`, [newData[key], guildId], `UpdateServer-${key}`)
                .catch(() => errors++)
        ));
        return errors === 0;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function deleteServer(guildId: string): Promise<boolean> {
    try {
        await query('DELETE FROM servers WHERE id = $1', [guildId], 'DeleteServer');
        return true;
    } catch (error) {
        return Promise.reject(false);
    }
}

export { getAllServers, getServer, addServer, updateServer, deleteServer };
