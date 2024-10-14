import query from '../api/dbConnect';
import { QueryResult } from 'pg';
import { NexusUser, NexusLinkedMod } from '../types/users';
import { Client, EmbedBuilder, User, Snowflake } from 'discord.js';
import { getModsbyUser } from './bot-db';
import { logMessage, nexusModsTrackingUrl } from './util';
import { DiscordBotUser } from './DiscordBotUser';

async function getAllUsers(): Promise<NexusUser[]> {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users', [], (error: Error, result?: QueryResult) => {
            if (error) return reject("Failed to get all users.");
            return resolve(result?.rows || []);
        });
    });
}

async function getUserByDiscordId(discordId: Snowflake | string): Promise<DiscordBotUser|undefined> {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users WHERE d_id = $1', [discordId], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            const user: NexusUser = result?.rows[0];
            if (user) {
                try {
                    const res = new DiscordBotUser(user);
                    return resolve(res)
                }
                catch(err) {
                    logMessage('Error in user lookup', { err, discordId, user }, true);
                    return reject('USER LOOKUP BY DISCORD ID FAILED.');
                }
            }
            else resolve(undefined);
        })
    
    });
}

async function getUserByNexusModsName(username: string): Promise<DiscordBotUser|undefined> {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [username], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            const user: NexusUser = result?.rows[0];
            if (user) {
                try {
                    const res = new DiscordBotUser(user);
                    return resolve(res)
                }
                catch(err) {
                    logMessage('Error in user lookup', { err, username, user }, true);
                    return reject('USER LOOKUP BY NEXUS MODS USERNAME FAILED.');
                }
            }
            else resolve(undefined);
        })
    });
}

async function getUserByNexusModsId(id: number): Promise<DiscordBotUser|undefined> {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users WHERE id = $1', [id], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            const user: NexusUser = result?.rows[0];
            if (user as NexusUser) resolve(new DiscordBotUser(user));
            else resolve(undefined);
        })
    });
}

async function createUser(user: NexusUser): Promise<DiscordBotUser> {
    // logMessage('Creating user', { name: user.name, auth: !!user.apikey || !!user.nexus_access });
    if (!user.apikey && !user.nexus_refresh) throw new Error('No auth information provided.');
    return new Promise(
        (resolve, reject) => {
        const { d_id, id, name, avatar_url, apikey, supporter, premium, modauthor, nexus_access, nexus_expires, nexus_refresh, discord_access, discord_expires, discord_refresh } = user;
        query('INSERT INTO users (d_id, id, name, avatar_url, apikey, supporter, premium, modauthor, nexus_access, nexus_expires, nexus_refresh, discord_access, discord_expires, discord_refresh, lastUpdate)'+
        ' VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *',
        [ 
            d_id, id, name, avatar_url, apikey, supporter, premium, modauthor||false, 
            nexus_access, nexus_expires, nexus_refresh, 
            discord_access, discord_expires, discord_refresh, 
            new Date()
        ], 
        (error: Error, result?: QueryResult) => {
            if (error) {
                //throw error;
                logMessage('Error inserting new user', error, true);
                return reject(error);
                //if (error.code === "23505") return reject(`Error ${error.code} - The field ${error.constraint} is not unique.`);
            };
            const user: NexusUser = result?.rows[0];
            // logMessage('Created user', { user });
            return resolve(new DiscordBotUser(user));
        })
    });
}

async function deleteUser(discordId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        query('DELETE FROM users WHERE d_id = $1', [discordId], (error: Error, result?: QueryResult) => {
            if (error) reject(error);
            resolve();
        });
    });
}

async function updateUser(discordId: string, newUser: Partial<NexusUser>): Promise<DiscordBotUser> {
    newUser.lastupdate = new Date();
    let values: any[] = [];
    let updateString: string[] = [];
    Object.entries(newUser).map(([key, value], idx) => {
        values.push(value);
        updateString.push(`${key} = $${idx + 1}`);
    });
    values.push(discordId);

    const updateQuery = `UPDATE users SET ${updateString.join(', ')} WHERE d_id = $${values.length} RETURNING *`;
    return new Promise(async (resolve, reject) => {
        query(updateQuery, values, (error: Error, result?: QueryResult) => {
            if (!!error) return reject(error);
            resolve(new DiscordBotUser(result?.rows[0]));
        });
    });
}

async function userEmbed(userData: NexusUser, client: Client): Promise<EmbedBuilder> {
    const discordUser: User = await client.users.fetch(userData.d_id);
    if (!discordUser) return Promise.reject('Unknown User');
    const mods: NexusLinkedMod[] = await getModsbyUser(userData.id);
    // const servers: NexusUserServerLink[] = userData.servers || await getLinksByUser(userData.id);
    const totalDownloads = (mods: NexusLinkedMod[]): number => {
        let downloads: number = mods.reduce((prev, cur) => prev = prev + cur.total_downloads, 0);
        return downloads;
    }
    let embed = new EmbedBuilder()
    .setAuthor({ name: "Member Search Results", iconURL: discordUser.avatarURL() || undefined})
    .addFields({ 
        name:  "Nexus Mods", 
        value: `[${userData.name}](https://nexusmods.com/users/${userData.id})\n${userData.premium ? "Premium Member" : userData.supporter ? "Supporter" : "Member"}`, 
        inline: true
    })
    .addFields({ name: "Discord", value: `${discordUser.toString()}\n${discordUser.tag}`, inline: true})
    .setColor(0xda8e35)
    .setThumbnail(userData.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setTimestamp(userData.lastupdate)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || ''});
    if (mods && mods.length) {
        let modData = mods.sort(modsort).map( mod => `[${mod.name}](https://nexusmods.com/${mod.path}) - ${mod.game}`);
        if (modData.length > 5) modData = modData.slice(0,4); //Only show a maximum of 5.
        embed.addFields({ name: `My Mods - ${totalDownloads(mods).toLocaleString()} downloads for ${mods.length} mod(s).`, value: `${modData.join("\n")}\n-----\n[**See all of ${userData.name}'s content at Nexus Mods.**](https://www.nexusmods.com/users/${userData.id}?tab=user+files)`})
    }
    // Show guilds.
    // let guilds: string[] = servers.map((link: NexusUserServerLink) => {
    //     const guild: Guild | undefined = client.guilds.cache.find(g => g.id === link.server_id)
    //     return guild ? guild.name : "Unknown server: "+link.server_id;
    // });
    // if (guilds.length > 5) {
    //     const total = guilds.length
    //     guilds = guilds.splice(0,4);
    //     guilds.push(`and ${total - 5} more...`);
    // } 
    // embed.addFields({ name: `Account connected in ${servers.length} server(s)`, value: guilds.join(", ") || "None"});

    return embed;
}

async function userProfileEmbed(user: DiscordBotUser, client: Client): Promise<EmbedBuilder> {
    const discordUser: User = await user.Discord.User(client);
    if (!discordUser) return Promise.reject('Unknown User');
    const mods: NexusLinkedMod[] = await user.NexusMods.LinkedMods();
    // const servers: NexusUserServerLink[] = userData.servers || await getLinksByUser(userData.id);
    const totalDownloads = (mods: NexusLinkedMod[]): number => {
        let downloads: number = mods.reduce((prev, cur) => prev = prev + cur.total_downloads, 0);
        return downloads;
    }

    const roleToShow: string = user.NexusModsRoles.has('premium') 
        ? "Premium Member" : user.NexusModsRoles.has('modauthor') 
        ? "Mod Author" : user.NexusModsRoles.has('supporter') 
        ? "Supporter" : "Member";

    let embed = new EmbedBuilder()
    .setAuthor({ name: "Member Search Results", iconURL: discordUser.avatarURL() || undefined})
    .addFields({ 
        name:  "Nexus Mods", 
        value: `[${user.NexusModsUsername}](${nexusModsTrackingUrl(`https://nexusmods.com/users/${user.NexusModsId}`, 'profile')})\n${roleToShow}`, 
        inline: true
    })
    .addFields({ name: "Discord", value: `${discordUser.toString()}\n${discordUser.tag}`, inline: true})
    .setColor(0xda8e35)
    .setThumbnail(user.NexusModsAvatar || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setTimestamp(user.LastUpdated)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || ''});
    if (mods && mods.length) {
        let modData = mods.sort(modsort).map( mod => `[${mod.name}](${nexusModsTrackingUrl(`https://nexusmods.com/${mod.path}`, 'profile')}) - ${mod.game}`);
        if (modData.length > 5) modData = modData.slice(0,4); //Only show a maximum of 5.
        embed.addFields({ name: `My Mods - ${totalDownloads(mods).toLocaleString()} downloads for ${mods.length} mod(s).`, value: `${modData.join("\n")}\n-----\n[**See all of ${user.NexusModsUsername}'s content at Nexus Mods.**](https://www.nexusmods.com/users/${user.NexusModsId}?tab=user+files)`})
    }

    return embed;
}

const modsort = (lh: NexusLinkedMod, rh: NexusLinkedMod): number => lh.total_downloads > rh.total_downloads ? -1 : 1;

export { getAllUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed, getUserByNexusModsId, userProfileEmbed };
