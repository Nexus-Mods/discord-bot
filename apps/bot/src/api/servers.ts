import query from '../api/dbConnect.js';
import { buildUpdate } from '../db/sql.js';
import { servers as serversTable } from '../db/schema.js';
import type { BotServer } from '../types/servers.js';
import type { Guild } from 'discord.js';
import { logger } from './logger.js';
import { NotFoundError } from './errors.js';

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

/**
 * Update a server's settings.
 *
 * This used to issue one UPDATE per key inside a Promise.all, which meant a failure
 * part-way through left the row partly updated with no way to tell which half had
 * landed. One statement is atomic, so it either all applies or none of it does.
 */
async function updateServer(guildId: string, newData: Partial<BotServer>): Promise<void> {
    const { text, values } = buildUpdate(
        serversTable,
        'servers',
        newData,
        { column: 'id', value: guildId },
    );

    await query(text, values, undefined);
}

async function deleteServer(guildId: string): Promise<void> {
    await query('DELETE FROM servers WHERE id = $1', [guildId], 'DeleteServer');
}

// addServer is not exported: getServer is the only caller, and it inserts on miss.
export { getAllServers, getServer, updateServer, deleteServer };
