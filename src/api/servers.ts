import query from '../api/dbConnect.js';
import { BotServer } from '../types/servers.js';
import { Guild } from 'discord.js';
import { logger } from './logger.js';
import { DatabaseError, NotFoundError } from './errors.js';

// query() already throws a DatabaseError carrying its cause and a user-facing
// message, so the try/catch blocks that only did `return Promise.reject(error)`
// have been removed rather than rewritten - they added nothing but a rejection
// with no stack.

async function getAllServers(): Promise<BotServer[]> {
    const result = await query<BotServer>('SELECT * FROM servers', [], 'GetAllServers');
    return result.rows;
}

async function getServer(guild: Guild): Promise<BotServer> {
    const result = await query<BotServer>('SELECT * FROM servers WHERE id = $1', [guild.id], 'GetServer');
    if (result?.rows?.length) return result.rows[0];

    logger.warn('Server lookup. Guild not found, inserting it', { guild: guild.name, id: guild.id });
    await addServer(guild);
    const created = await query<BotServer>('SELECT * FROM servers WHERE id = $1', [guild.id], 'GetServer');
    if (!created?.rows?.length) {
        // Previously this recursed into getServer(), which could loop if the insert
        // succeeded but the row was still not visible.
        throw new NotFoundError(`Server ${guild.id} was inserted but could not be read back.`);
    }
    return created.rows[0];
}

async function addServer(guild: Guild): Promise<boolean> {
    const owner = await guild.fetchOwner();
    await query('INSERT INTO servers (id, server_owner) VALUES ($1, $2)', [guild.id, owner?.id], 'AddServer');
    logger.info('Added server to database', { guild: guild.name, id: guild.id });
    return true;
}

async function updateServer(guildId: string, newData: Partial<BotServer>): Promise<void> {
    // Each key is a separate statement, so a failure part-way through leaves the row
    // partly updated. This used to count failures and return a boolean, discarding
    // the actual database error; now the first failure surfaces.
    const failures: { key: string; error: unknown }[] = [];
    await Promise.all(Object.keys(newData).map(async (key) => {
        try {
            await query(
                `UPDATE servers SET ${key} = $1 WHERE id = $2`,
                [newData[key as keyof BotServer], guildId],
                `UpdateServer-${key}`,
            );
        }
        catch (error) {
            failures.push({ key, error });
        }
    }));

    if (failures.length) {
        throw new DatabaseError(`Failed to update ${failures.length} server setting(s).`, {
            cause: failures[0].error,
            context: { guildId, keys: failures.map((f) => f.key) },
            userMessage: 'Your server settings could not be saved. Please try again in a few minutes.',
        });
    }
}

async function deleteServer(guildId: string): Promise<void> {
    await query('DELETE FROM servers WHERE id = $1', [guildId], 'DeleteServer');
}

export { getAllServers, getServer, addServer, updateServer, deleteServer };
