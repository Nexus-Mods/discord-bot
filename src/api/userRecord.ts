import query from './dbConnect.js';
import { buildUpdate } from '../db/sql.js';
import { users as usersTable } from '../db/schema.js';
import { logger } from './logger.js';
import type { NexusUser } from '../types/users.js';

/**
 * Update a user row and return the row.
 *
 * Split out of api/users.ts so that DiscordBotUser can save itself without importing
 * the module that constructs DiscordBotUser instances. That import was one half of a
 * runtime cycle: the model imported persistence to write itself, and persistence
 * imported the model to build return values. Row in, row out - no model here.
 */
export async function updateUserRecord(
    discordId: string,
    newUser: Partial<NexusUser>,
): Promise<NexusUser> {
    // Column names cannot be bind parameters, so buildUpdate checks each one against
    // the schema instead of interpolating whatever keys it was handed.
    const { text, values } = buildUpdate(
        usersTable,
        'users',
        { ...newUser, lastupdate: new Date() },
        { column: 'd_id', value: discordId },
    );

    try {
        const result = await query<NexusUser>(`${text} RETURNING *`, values);
        return result.rows[0];
    }
    catch (err) {
        logger.error('Error updating user', { discordId, err });
        throw err;
    }
}
