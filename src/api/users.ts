import query from '../api/dbConnect.js';
import { buildUpdate } from '../db/sql.js';
import { users as usersTable } from '../db/schema.js';
import { NexusUser } from '../types/users.js';
import { Client, EmbedBuilder, User, Snowflake } from 'discord.js';
import { nexusModsTrackingUrl } from './util.js';
import { DiscordBotUser } from './DiscordBotUser.js';
import { logger } from './logger.js';
import { NEXUS_ORANGE, botIconUrl } from '../lib/embeds.js';

async function getAllUsers(): Promise<NexusUser[]> {
    try {
        const result = await query<NexusUser>('SELECT * FROM users', []);
        return result.rows;
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
        const user: NexusUser = result?.rows[0];
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
        const user: NexusUser = result?.rows[0];
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
        const user: NexusUser = result?.rows[0];
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

    try {
        const result = await query<NexusUser>(
            'INSERT INTO users (d_id, id, name, avatar_url, supporter, premium, modauthor, nexus_access, nexus_expires, nexus_refresh, discord_access, discord_expires, discord_refresh, lastUpdate) ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
            [
                user.d_id, user.id, user.name, user.avatar_url, user.supporter, user.premium, user.modauthor || false,
                user.nexus_access, user.nexus_expires, user.nexus_refresh,
                user.discord_access, user.discord_expires, user.discord_refresh,
                new Date()
            ]
        );
        return new DiscordBotUser(result?.rows[0], logger);
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
        return new DiscordBotUser(result?.rows[0], logger);
    }
    catch (err) {
        logger.error('Error updating user', { discordId, err });
        throw err;
    }
}

async function userEmbed(userData: NexusUser, client: Client): Promise<EmbedBuilder> {
    try {
        const discordUser: User = await client.users.fetch(userData.d_id);
        if (!discordUser) throw new Error('Unknown User');

        const embed = new EmbedBuilder()
            .setAuthor({ name: "Member Search Results", iconURL: discordUser.avatarURL() || undefined })
            .addFields({
                name: "Nexus Mods",
                value: `[${userData.name}](https://nexusmods.com/users/${userData.id})\n${userData.premium ? "Premium Member" : userData.supporter ? "Supporter" : "Member"}`,
                inline: true
            })
            .addFields({ name: "Discord", value: `${discordUser.toString()}\n${discordUser.tag}`, inline: true })
            .setColor(NEXUS_ORANGE)
            .setThumbnail(userData.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
            .setTimestamp(userData.lastupdate)
            .setFooter({ text: `User ID: ${userData.id}`, iconURL: botIconUrl(client) });


        return embed;
    }
    catch (err) {
        logger.error('Error creating user embed', { userData, err });
        throw err;
    }
}

async function userProfileEmbed(user: DiscordBotUser, client: Client): Promise<EmbedBuilder> {
    try {
        const discordUser: User = await user.Discord.User(client);
        if (!discordUser) throw new Error('Unknown User');

        const roleToShow: string = user.NexusModsRoles.has('premium')
            ? "Premium Member" : user.NexusModsRoles.has('modauthor')
                ? "Mod Author" : user.NexusModsRoles.has('supporter')
                    ? "Supporter" : "Member";

        const embed = new EmbedBuilder()
            .setAuthor({ name: "Member Search Results", iconURL: discordUser.avatarURL() || undefined })
            .addFields({
                name: "Nexus Mods",
                value: `[${user.NexusModsUsername}](${nexusModsTrackingUrl(`https://nexusmods.com/users/${user.NexusModsId}`, 'profile')})\n${roleToShow}`,
                inline: true
            })
            .addFields({ name: "Discord", value: `${discordUser.toString()}\n${discordUser.tag}`, inline: true })
            .setColor(NEXUS_ORANGE)
            .setThumbnail(user.NexusModsAvatar || 'https://www.nexusmods.com/assets/images/default/avatar.png')
            .setTimestamp(user.LastUpdated)
            .setFooter({ text: `User ID: ${user.NexusModsId}`, iconURL: botIconUrl(client) });

        return embed;
    }
    catch (err) {
        logger.error('Error creating user profile embed', { nexusModsId: user.NexusModsId, err });
        throw err;
    }
}

export { getAllUsers, getCountOfUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed, getUserByNexusModsId, userProfileEmbed };
