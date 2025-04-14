import query from '../api/dbConnect';
import { NexusUser } from '../types/users';
import { Client, EmbedBuilder, User, Snowflake } from 'discord.js';
import { nexusModsTrackingUrl } from './util';
import { DiscordBotUser } from './DiscordBotUser';
import { logger } from '../DiscordBot';

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
    newUser.lastupdate = new Date();
    let values: any[] = [];
    let updateString: string[] = [];

    Object.entries(newUser).forEach(([key, value], idx) => {
        values.push(value);
        updateString.push(`${key} = $${idx + 1}`);
    });
    values.push(discordId);

    const updateQuery = `UPDATE users SET ${updateString.join(', ')} WHERE d_id = $${values.length} RETURNING *`;

    try {
        const result = await query<NexusUser>(updateQuery, values);
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

        let embed = new EmbedBuilder()
            .setAuthor({ name: "Member Search Results", iconURL: discordUser.avatarURL() || undefined })
            .addFields({
                name: "Nexus Mods",
                value: `[${userData.name}](https://nexusmods.com/users/${userData.id})\n${userData.premium ? "Premium Member" : userData.supporter ? "Supporter" : "Member"}`,
                inline: true
            })
            .addFields({ name: "Discord", value: `${discordUser.toString()}\n${discordUser.tag}`, inline: true })
            .setColor(0xda8e35)
            .setThumbnail(userData.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
            .setTimestamp(userData.lastupdate)
            .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });


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

        let embed = new EmbedBuilder()
            .setAuthor({ name: "Member Search Results", iconURL: discordUser.avatarURL() || undefined })
            .addFields({
                name: "Nexus Mods",
                value: `[${user.NexusModsUsername}](${nexusModsTrackingUrl(`https://nexusmods.com/users/${user.NexusModsId}`, 'profile')})\n${roleToShow}`,
                inline: true
            })
            .addFields({ name: "Discord", value: `${discordUser.toString()}\n${discordUser.tag}`, inline: true })
            .setColor(0xda8e35)
            .setThumbnail(user.NexusModsAvatar || 'https://www.nexusmods.com/assets/images/default/avatar.png')
            .setTimestamp(user.LastUpdated)
            .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' });

        return embed;
    }
    catch (err) {
        logger.error('Error creating user profile embed', { user, err });
        throw err;
    }
}

export { getAllUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed, getUserByNexusModsId, userProfileEmbed };
