import query from './dbConnect';
import { QueryResult } from 'pg';
import { NexusUser, NexusLinkedMod, NexusUserServerLink } from '../types/users';
import { BotServer } from '../types/servers';
import { getAllServers, getServer } from './bot-db';
import { Client, User, Guild, GuildMember, Role, GuildChannel, MessageEmbed, ThreadChannel, PermissionString, RoleResolvable } from 'discord.js';
import { getModsbyUser } from './user_mods';
import { logMessage } from './util';

async function getLinksByUser(userId: number): Promise<NexusUserServerLink[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM user_servers WHERE user_id = $1', [userId], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            resolve(result?.rows || []);
        });

    });
}

async function getLinksByServer(guildId: string): Promise<NexusUserServerLink[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM user_servers WHERE server_id = $1', [guildId], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            resolve(result?.rows || []);
        });
    });
}

async function addServerLink(client: Client, user: NexusUser, discordUser: User, server: Guild | null): Promise<void> {
    if (!server) return;
    return new Promise((resolve, reject) => {
        query('INSERT INTO user_servers (user_id, server_id) VALUES ($1, $2)', [user.id, server.id], async (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            await updateRoles(client, user, discordUser, server);
            resolve();
        });
    });
}

async function deleteServerLink(client: Client, user: NexusUser, discordUser: User | undefined, server: Guild): Promise<void> {
    return new Promise( (resolve, reject) => {
        query('DELETE FROM user_servers WHERE user_id = $1 AND server_id = $2', [user.id, server.id], 
        async (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            if (!!discordUser) await updateRoles(client, user, discordUser, server, true);
            resolve();
        });
    });
}

async function deleteAllServerLinksByUser(client: Client, user: NexusUser, discordUser: User): Promise<void> {
    const links: NexusUserServerLink[] = await getLinksByUser(user.id);

    return new Promise((resolve, reject) => {
        query('DELETE FROM user_servers WHERE user_id = $1', [user.id], async (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            for (const link of links) {
                const server = await client.guilds.fetch(link.server_id);
                if (server) await updateRoles(client, user, discordUser, server, true);
            }
            resolve();
        });
    });
}

async function updateRoles(client: Client, userData: NexusUser, discordUser: User, guild: Guild, bRemove: boolean = false): Promise<void> {
    // logMessage('Updating roles', { user: discordUser.tag, nexus: userData.name, guild: guild.name });
    return new Promise(async (resolve, reject) => {
        const guildMember: GuildMember|undefined = await guild.members.fetch(discordUser.id).catch(() => undefined);
        const allUserMods: NexusLinkedMod[] = await getModsbyUser(userData.id);
        const guildData: BotServer|undefined = await getServer(guild).catch(() => undefined);
        if (!guildData) return reject('No guild data for '+guild.name);
        // If the user isn't a member of this guild we can exit.
        if (!guildMember) return resolve();

        const nexusLogChannel: GuildChannel|ThreadChannel|undefined|null = guildData.channel_nexus ? guild.channels.resolve(guildData.channel_nexus) : undefined;

        // Check we can actually assign roles.
        const botMember = client.user ? await guild.members.fetch(client.user.id): undefined;
        const botPermissions: PermissionString[] = botMember?.permissions.toArray() || [];
        if (!botPermissions.includes('MANAGE_ROLES') && !botPermissions.includes('ADMINISTRATOR')) {            
            if (guildData.role_premium || guildData.role_linked || guildData.role_supporter || guildData.role_author) {
                // Only write a log message if I am expected to have these permissions. 
                logMessage(`Permissions in ${guild.name} do not allow role assignment.`);
            }
            return resolve();
        }

        // Check the user we're trying to update doesn't outrank use
        const botHighestRole: number = botMember?.roles.highest.position || 0;
        const memberHighestRole: number = guildMember.roles.highest.position;
        if (memberHighestRole > botHighestRole) {
            logMessage('Cannot assign roles to a higher ranked user', { guild: guild.name, member: discordUser.tag,botHighestRole, memberHighestRole });
            return resolve();
        };

        let rolesToAdd: RoleResolvable[] = [];
        
        // Get the roles
        const premiumRole: (Role | null) = guildData.role_premium ? await guild.roles.fetch(guildData.role_premium) : null;
        const supporterRole: (Role | null) = guildData.role_supporter ? await guild.roles.fetch(guildData.role_supporter) : null;
        const linkedRole: (Role | null) = guildData.role_linked ? await guild.roles.fetch(guildData.role_linked) : null;
        const modAuthorRole: (Role | null) = guildData.role_author ? await guild.roles.fetch(guildData.role_author) : null;
        const modAuthorDownloads: number = guildData.author_min_downloads ? parseInt(guildData.author_min_downloads) : -1;

        // Collect all the ids for removal. 
        const allRoles: (RoleResolvable|undefined)[] = [
            premiumRole ? premiumRole.id : undefined, 
            supporterRole ? supporterRole.id : undefined, 
            linkedRole ? linkedRole.id : undefined, 
            modAuthorRole ? modAuthorRole.id : undefined
        ].filter(r => r !== undefined);

        // Remove all roles if we're unlinking.
        if (bRemove) {
            logMessage(`Removing roles from ${guildMember.user.tag} (${userData.name}) in ${guild.name}`);
            try {
                await guildMember.roles.remove(allRoles as RoleResolvable[], 'Nexus Mods Discord unlink');
                if (nexusLogChannel) (nexusLogChannel as any).send({ embeds: [linkEmbed(userData, discordUser, true)] }).catch(() => undefined);
            }
            catch (err) {
                logMessage(`Could not remove roles from ${userData.name} in ${guild.name}`, (err as Error)?.message, true);
            }            
            return resolve();
        }

        // Linked role
        if (linkedRole && !guildMember.roles.cache.has(linkedRole.id)) rolesToAdd.push(linkedRole.id);

        // Membership roles
        if (userData.premium && premiumRole && !guildMember.roles.cache.has(premiumRole.id)) rolesToAdd.push(premiumRole.id)
        else if (userData.supporter && supporterRole && !guildMember.roles.cache.has(supporterRole.id)) rolesToAdd.push(supporterRole.id);

        // Mod Author role
        const modUniqueTotal: number = modUniqueDLTotal(allUserMods);
        // Log the details if the user isn't recognised yet. 
        if (modAuthorRole && !guildMember.roles.cache.has(modAuthorRole.id)) logMessage(`${userData.name} has ${modUniqueTotal} unique downloads for ${allUserMods.length} mods. ${guild.name} threshold ${modAuthorDownloads}`);
        // Apply the MA role if the criteria has been met.
        if (modAuthorRole && !guildMember.roles.cache.has(modAuthorRole.id)) {
            if ((modUniqueTotal !== -1 && modUniqueTotal >= modAuthorDownloads) || userData.modauthor) {
                rolesToAdd.push(modAuthorRole.id);
                logMessage(`${userData.name} as now a recognised mod author in ${guild.name}`);
                (guildMember as any).send(`Congratulations! You are now a recognised mod author in ${guild.name}!`).catch(() => undefined);     
            }
            else logMessage(`${userData.name} has ${modUniqueTotal} unique downloads for ${allUserMods.length} mods. ${guild.name} threshold ${modAuthorDownloads}`);
        }
        else if (modAuthorRole && guildMember.roles.cache.has(modAuthorRole.id) && modUniqueTotal < modAuthorDownloads) guildMember.roles.remove(modAuthorRole);

        if (rolesToAdd.length) {
            logMessage(`Adding ${rolesToAdd.length} roles to ${guildMember.user.tag} (${userData.name}) in ${guild.name}`);
            guildMember.roles.add(rolesToAdd, 'Nexus Mods Discord link')
            .catch(err => logMessage(`Could not add roles to ${userData.name} in ${guild.name}`, err, true));
        }

        const links: NexusUserServerLink[] = await getLinksByUser(userData.id);
        const existingLink: NexusUserServerLink|undefined = links.find(l => l.server_id === guild.id);
        if (nexusLogChannel && !existingLink) (nexusLogChannel as any).send({ embeds: [linkEmbed(userData, discordUser)] }).catch(() => undefined);
        
        return resolve();


    });
}

async function updateAllRoles(client: Client, userData: NexusUser, discordUser: User, addAll: boolean = false): Promise<void> {
    logMessage('Updating roles', { user: discordUser.tag, nexus: userData.name });
    return new Promise(async (resolve, reject) => {
        const servers: BotServer[] = await getAllServers();
        const links: NexusUserServerLink[] = await getLinksByUser(userData.id);
        // console.log(`${new Date().toLocaleString()} - Updating all roles for ${userData.name} (${discordUser.tag})`);
        for(const server of servers) {
            const guild: Guild | undefined = await client.guilds.fetch(server.id).catch(() => undefined);
            const guildMember: GuildMember|undefined = guild ? await guild.members.fetch(discordUser.id).catch(() => undefined) : undefined;
            if (!guildMember) continue;
            const existingLink: boolean = !!links.find(l => l.server_id == server.id);
            if (guild) {
                if (addAll || existingLink) {
                    if (!existingLink) await addServerLink(client, userData, discordUser, guild).catch(console.error);
                    else await updateRoles(client, userData, discordUser, guild).catch(err => console.warn(`${new Date().toLocaleString()} - Unable to assign roles to ${userData.name}`, err));
                }
            }            
        }
        resolve();
    })
}

const modUniqueDLTotal = (allMods: NexusLinkedMod[]): number => {
    logMessage('Getting UDL total from mods', { count: allMods.length });
    let downloads: number = allMods.reduce((prev, cur) => {
        if (cur.unique_downloads && !isNaN(cur.unique_downloads)) prev = prev + cur.unique_downloads;
        else logMessage('Unique download count could not be added', { mod: cur }, true);
        return prev;
    }, 0);
    return isNaN(downloads) ? downloads : 0;
}

const linkEmbed = (user: NexusUser, discord: User, remove?: boolean): MessageEmbed => {
    const embed = new MessageEmbed()
    .setAuthor({ name: `Account ${remove ? 'Unlinked' : 'Linked'}`, iconURL: user.avatar_url})
    .setDescription(`${discord.toString()} ${remove ? 'unlinked from' : 'linked to'} [${user.name}](https://nexusmods.com/users/${user.id}).`)
    .setTimestamp(new Date())
    .setColor(0xda8e35)
    .setFooter({ text: '🔗 Nexus Mods API link' });

    return embed;
}

export { getLinksByUser, getLinksByServer, addServerLink, deleteServerLink, deleteAllServerLinksByUser, updateRoles, updateAllRoles, modUniqueDLTotal };
