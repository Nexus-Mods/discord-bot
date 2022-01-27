import query from '../api/dbConnect';
import { QueryResult } from 'pg';
import { NexusUser, NexusLinkedMod, NexusUserServerLink } from '../types/users';
import { Client, MessageEmbed, Message, User, Guild, Snowflake } from 'discord.js';
import { getModsbyUser, getLinksByUser } from './bot-db';

async function getAllUsers(): Promise<NexusUser[]> {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users', [], (error: Error, result?: QueryResult) => {
            if (error) return reject("Failed to get all users.");
            return resolve(result?.rows || []);
        });
    });
}

async function getUserByDiscordId(discordId: Snowflake | string): Promise<NexusUser> {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users WHERE d_id = $1', [discordId], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            //console.log(result.rows);
            resolve(result?.rows[0]);
        })
    
    });
}

async function getUserByNexusModsName(username: string): Promise<NexusUser> {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users WHERE LOWER(name) = LOWER($1)', [username], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            resolve(result?.rows[0]);
        })
    });
}

async function getUserByNexusModsId(id: number): Promise<NexusUser> {
    return new Promise( (resolve, reject) => {
        query('SELECT * FROM users WHERE id = $1', [id], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            resolve(result?.rows[0]);
        })
    });
}

async function createUser(user: NexusUser): Promise<boolean> {
    return new Promise(
        (resolve, reject) => {
        query('INSERT INTO users (d_id, id, name, avatar_url, apikey, supporter, premium, lastUpdate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [user.d_id, user.id, user.name, user.avatar_url, user.apikey, user.supporter, user.premium, new Date()], 
        (error: Error, result?: QueryResult) => {
            if (error) {
                //throw error;
                console.log(error);
                return reject(error);
                //if (error.code === "23505") return reject(`Error ${error.code} - The field ${error.constraint} is not unique.`);
            };
            //console.log("User inserted into the database: "+user.nexusName);
            resolve(true);
        })
    });
}

async function deleteUser(discordId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        query('DELETE FROM users WHERE d_id = $1', [discordId], (error: Error, result?: QueryResult) => {
            if (error) {
                //throw error;
                reject(false);
            };
            resolve(true);
        });
    });
}

async function updateUser(discordId: string, newUser: any): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
        let errors = 0;
        newUser.lastupdate = new Date();
        Object.keys(newUser).forEach((key: string) => {
            query(`UPDATE users SET ${key} = $1 WHERE d_id = $2`, [newUser[key], discordId], (error: Error, result?: QueryResult) => {
                if (error) errors += 1;
            });
        });
        if (errors > 0) resolve(false);
        else resolve(true);
    });
}

async function userEmbed(userData: NexusUser, message: Message, client: Client): Promise<MessageEmbed> {
    const discordUser: User = await client.users.fetch(userData.d_id);
    if (!discordUser) return Promise.reject('Unknown User');
    const mods: NexusLinkedMod[] = await getModsbyUser(userData.id);
    const servers: NexusUserServerLink[] = userData.servers || await getLinksByUser(userData.id);
    const totalDownloads = (mods: NexusLinkedMod[]): number => {
        let downloads: number = mods.reduce((prev, cur) => prev = prev + cur.total_downloads, 0);
        return downloads;
    }
    let embed = new MessageEmbed()
    .setAuthor({ name: "Member Search Results", iconURL: discordUser.avatarURL() || ''})
    .addField("Nexus Mods", `[${userData.name}](https://nexusmods.com/users/${userData.id})\n${userData.premium ? "Premium Member" : userData.supporter ? "Supporter" : "Member"}`, true)
    .addField("Discord", `${discordUser.toString()}\n${discordUser.tag}`, true)
    .setColor(0xda8e35)
    .setThumbnail(userData.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setTimestamp(userData.lastupdate)
    .setFooter({ text: `Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL: client.user?.avatarURL() || ''});
    if (mods && mods.length) {
        let modData = mods.sort(modsort).map( mod => `[${mod.name}](https://nexusmods.com/${mod.path}) - ${mod.game}`);
        if (modData.length > 5) modData = modData.slice(0,4); //Only show a maximum of 5.
        embed.addField(`My Mods - ${totalDownloads(mods).toLocaleString()} downloads for ${mods.length} mod(s).`, `${modData.join("\n")}\n-----\n[**See all of ${userData.name}'s content at Nexus Mods.**](https://www.nexusmods.com/users/${userData.id}?tab=user+files)`)
    }
    // Show guilds.
    let guilds: string[] = servers.map((link: NexusUserServerLink) => {
        const guild: Guild | undefined = client.guilds.cache.find(g => g.id === link.server_id)
        return guild ? guild.name : "Unknown server: "+link.server_id;
    });
    if (guilds.length > 5) {
        const total = guilds.length
        guilds = guilds.splice(0,4);
        guilds.push(`and ${total - 5} more...`);
    } 
    embed.addField(`Account connected in ${servers.length} server(s)`, guilds.join(", ") || "None");

    return embed;
}

const modsort = (lh: NexusLinkedMod, rh: NexusLinkedMod): number => lh.total_downloads > rh.total_downloads ? -1 : 1;

export { getAllUsers, getUserByDiscordId, getUserByNexusModsName, createUser, deleteUser, updateUser, userEmbed, getUserByNexusModsId };
