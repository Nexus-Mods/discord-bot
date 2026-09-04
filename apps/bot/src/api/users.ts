import query from '../api/dbConnect.js';
import type { NexusUser } from '../types/users.js';
import type { Snowflake } from 'discord.js';
import { DiscordBotUser } from './DiscordBotUser.js';
import { updateUserRecord } from './userRecord.js';
import { logger } from './logger.js';
import { openUserTokens, sealUserTokens } from '../db/tokenCrypto.js';

async function getAllUsers(): Promise<NexusUser[]> {
    try {
        const result = await query<NexusUser>('SELECT * FROM users', []);
        return result.rows.map(openUserTokens);
    }
    catch (err) {
        logger.error('Error getting all users', err);
        return [];
    }
}

/**
 * How many linked users there are.
 *
 * `pg` returns COUNT(*) as a string, because a bigint does not fit in a JS number -
 * hence the conversion. This was typed `{ count: number }` and then converted
 * anyway, so the type was a lie that the runtime quietly worked around.
 *
 * It also used to swallow failures and return 0, which is indistinguishable from a
 * genuine empty table. The one caller (`/about`) already falls back to 0 itself, so
 * reporting the failure here costs nothing and stops "0 users" from being displayed
 * as a fact when the database is simply unreachable.
 */
async function getCountOfUsers(): Promise<number> {
    const result = await query<{ count: string }>('SELECT COUNT(*) FROM users', [], 'GetCountOfUsers');
    return Number(result.rows[0].count);
}

async function getUserByDiscordId(discordId: Snowflake | string): Promise<DiscordBotUser | undefined> {
    try {
        const result = await query<NexusUser>('SELECT * FROM users WHERE d_id = $1', [discordId]);
        const user: NexusUser = openUserTokens(result?.rows[0]);
        if (user) {
            return new DiscordBotUser(user, logger);
        }
        return undefined;
    }
    catch (err) {
        logger.error('Error in user lookup by Discord ID', { err, discordId });
        return undefined;
    }
}

async function getUserByNexusModsName(username: string): Promise<DiscordBotUser | undefined> {
    try {
        const result = await query<NexusUser>('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [username]);
        const user: NexusUser = openUserTokens(result?.rows[0]);
        if (user) {
            return new DiscordBotUser(user, logger);
        }
        return undefined;
    }
    catch (err) {
        logger.error('Error in user lookup by Nexus Mods username', { err, username });
        return undefined;
    }
}

async function getUserByNexusModsId(id: number): Promise<DiscordBotUser | undefined> {
    try {
        const result = await query<NexusUser>('SELECT * FROM users WHERE id = $1', [id]);
        const user: NexusUser = openUserTokens(result?.rows[0]);
        if (user) {
            return new DiscordBotUser(user, logger);
        }
        return undefined;
    }
    catch (err) {
        logger.error('Error in user lookup by Nexus Mods ID', { err, id });
        return undefined;
    }
}

async function createUser(user: NexusUser): Promise<DiscordBotUser> {
    if (!user.nexus_refresh) {
        throw new Error('No auth information provided.');
    }

    // Sealed before the values reach the statement, and the returned row is opened
    // again, so a caller cannot tell that anything happened.
    const sealed = sealUserTokens(user);

    try {
        const result = await query<NexusUser>(
            'INSERT INTO users (d_id, id, name, avatar_url, supporter, premium, modauthor, nexus_access, nexus_expires, nexus_refresh, discord_access, discord_expires, discord_refresh, lastUpdate) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
            [
                sealed.d_id, sealed.id, sealed.name, sealed.avatar_url, sealed.supporter, sealed.premium, sealed.modauthor || false,
                sealed.nexus_access, sealed.nexus_expires, sealed.nexus_refresh,
                sealed.discord_access, sealed.discord_expires, sealed.discord_refresh,
                new Date()
            ]
        );
        return new DiscordBotUser(openUserTokens(result?.rows[0]), logger);
    }
    catch (err) {
        logger.error('Error inserting new user', err);
        throw err;
    }
}

async function deleteUser(discordId: string): Promise<void> {
    try {
        await query('DELETE FROM users WHERE d_id = $1', [discordId]);
    }
    catch (err) {
        logger.error('Error deleting user', { discordId, err });
        throw err;
    }
}

async function updateUser(discordId: string, newUser: Partial<NexusUser>): Promise<DiscordBotUser> {
    return new DiscordBotUser(await updateUserRecord(discordId, newUser), logger);
}



export { getAllUsers, getCountOfUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, getUserByNexusModsId };
// Presentation lives in lib/profile.ts and is imported from there. This module used to
// re-export it, which is a runtime edge: every reader of a user - the auth site included
// - pulled EmbedBuilder in behind the data layer.
