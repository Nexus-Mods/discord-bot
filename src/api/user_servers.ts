import query from './dbConnect';
import { NexusLinkedMod, NexusUserServerLink } from '../types/users';
import { Client, User, Guild } from 'discord.js';
import { DiscordBotUser } from './DiscordBotUser';
import { logger } from '../DiscordBot';

async function getAllLinks(): Promise<NexusUserServerLink[]> {
    try {
        const result = await query<NexusUserServerLink>('SELECT * FROM user_servers', [], 'GetAllLinks');
        return result.rows;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getLinksByUser(userId: number): Promise<NexusUserServerLink[]> {
    try {
        const result = await query<NexusUserServerLink>('SELECT * FROM user_servers WHERE user_id = $1', [userId], 'GetLinksByUser');
        return result.rows;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getLinksByServer(guildId: string): Promise<NexusUserServerLink[]> {
    try {
        const result = await query<NexusUserServerLink>('SELECT * FROM user_servers WHERE server_id = $1', [guildId], 'GetLinksByServer');
        return result.rows;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function addServerLink(client: Client, user: DiscordBotUser, discordUser: User, server: Guild | null): Promise<void> {
    if (!server) return;
    try {
        await query('INSERT INTO user_servers (user_id, server_id) VALUES ($1, $2)', [user.NexusModsId, server.id], 'AddServerLink');
        // await updateRoles(client, user, discordUser, server);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function deleteServerLink(client: Client, user: DiscordBotUser, discordUser: User | undefined, server: Guild): Promise<void> {
    try {
        await query('DELETE FROM user_servers WHERE user_id = $1 AND server_id = $2', [user.NexusModsId, server.id], 'DeleteServerLink');
        // if (discordUser) await updateRoles(client, user, discordUser, server, true);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function deleteAllServerLinksByUser(client: Client, user: DiscordBotUser, discordUser: User): Promise<void> {
    const links: NexusUserServerLink[] = await getLinksByUser(user.NexusModsId);
    try {
        await query('DELETE FROM user_servers WHERE user_id = $1', [user.NexusModsId], 'DeleteAllServerLinksByUser');
        for (const link of links) {
            const server = await client.guilds.fetch(link.server_id);
            // if (server) await updateRoles(client, user, discordUser, server, true);
        }
    } catch (error) {
        return Promise.reject(error);
    }
}

async function deleteServerLinksByUserSilent(userId: Number): Promise<void> {
    try {
        await query('DELETE FROM user_servers WHERE user_id = $1', [userId], 'DeleteServerLinksByUserSilent');
    } catch (error) {
        return Promise.reject(error);
    }
}

async function deleteServerLinksByServerSilent(userId: string): Promise<void> {
    try {
        await query('DELETE FROM user_servers WHERE server_id = $1', [userId], 'DeleteServerLinksByServerSilent');
    } catch (error) {
        return Promise.reject(error);
    }
}

const modUniqueDLTotal = (allMods: NexusLinkedMod[]): number => {
    let downloads: number = allMods.reduce((prev, cur) => {
        if (!!cur.unique_downloads || !isNaN(cur.unique_downloads)) prev = prev + cur.unique_downloads;
        else logger.warn('Unique download count could not be added', { mod: cur });
        return prev;
    }, 0);
    return !isNaN(downloads) ? downloads : 0;
}

export { getAllLinks, getLinksByUser, getLinksByServer, addServerLink, deleteServerLink, 
    deleteServerLinksByUserSilent, deleteServerLinksByServerSilent,
    deleteAllServerLinksByUser, modUniqueDLTotal };
