import query from './dbConnect';
import { QueryResult } from 'pg';
import { NexusUser, NexusLinkedMod, NexusUserServerLink } from '../types/users';
import { BotServer } from '../types/servers';
import { getAllServers, getServer } from './bot-db';
import { Client, User, Guild, GuildMember, Role, GuildChannel, MessageEmbed, TextChannel, ThreadChannel, Snowflake, RoleResolvable } from 'discord.js';
import { getModsbyUser } from './user_mods';
import { NexusSearchResult } from '../types/util';

async function getLinksByUser(userId: number): Promise<NexusUserServerLink[]> {
    return new Promise((resolve, reject) => {
        query('SELECT * FROM user_servers WHERE user_id = $1', [userId], (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            resolve(result?.rows || []);
        });

    });
}

async function addServerLink(client: Client, user: NexusUser, discordUser: User, server: Guild): Promise<void> {
    return new Promise((resolve, reject) => {
        query('INSERT INTO user_servers (user_id, server_id) VALUES ($1, $2)', [user.id, server.id], async (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            await updateRoles(client, user, discordUser, server);
            resolve();
        });
    });
}

async function deleteServerLink(client: Client, user: NexusUser, discordUser: User, server: Guild): Promise<void> {
    return new Promise( (resolve, reject) => {
        query('DELETE FROM user_servers WHERE user_id = $1 AND server_id = $2', [user.id, server.id], 
        async (error: Error, result?: QueryResult) => {
            if (error) return reject(error);
            await updateRoles(client, user, discordUser, server, true);
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
        if (!botMember || !botMember.permissions.has('MANAGE_ROLES')) {
            console.log(`${new Date().toLocaleString()} - Permissions in ${guild.name} do not allow role assignment.`);
            return resolve();
        }

        let rolesToAdd: RoleResolvable[] = [];
        
        // Get the roles
        const premiumRole: (Role | null) = guildData.role_premium ? await guild.roles.fetch(guildData.role_premium) : null;
        const supporterRole: (Role | null) = guildData.role_supporter ? await guild.roles.fetch(guildData.role_supporter) : null;
        const linkedRole: (Role | null) = guildData.role_linked ? await guild.roles.fetch(guildData.role_linked) : null;
        const modAuthorRole: (Role | null) = guildData.role_author ? await guild.roles.fetch(guildData.role_author) : null;
        const modAuthorDownloads: number = guildData.author_min_downloads || 1000;

        // Collect all the ids for removal. 
        const allRoles: (RoleResolvable|undefined)[] = [
            premiumRole ? premiumRole.id : undefined, 
            supporterRole ? supporterRole.id : undefined, 
            linkedRole ? linkedRole.id : undefined, 
            modAuthorRole ? modAuthorRole.id : undefined
        ].filter(r => r !== undefined);

        // Remove all roles if we're unlinking.
        if (bRemove) {
            console.log(`${new Date().toLocaleString()} - Removing roles from ${guildMember.user.tag} (${userData.name}) in ${guild.name}`);
            guildMember.roles.remove(allRoles as RoleResolvable[], 'Nexus Mods Discord unlink')
                .catch(err => console.log(`${new Date().toLocaleString()} - Could not remove roles from ${userData.name} in ${guild.name}`, err.message));
            if (nexusLogChannel) (nexusLogChannel as TextChannel).send({ embeds: [linkEmbed(userData, discordUser, true)] }).catch(() => undefined);
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
        if (modAuthorRole && !guildMember.roles.cache.has(modAuthorRole.id)) console.log(`${new Date().toLocaleString()} - ${userData.name} has ${modUniqueTotal} unique downloads for ${allUserMods.length} mods. ${guild.name} threshold ${modAuthorDownloads}`);
        // Apply the MA role if the criteria has been met.
        if (modAuthorRole && modUniqueTotal >= modAuthorDownloads && !guildMember.roles.cache.has(modAuthorRole.id)) {
            rolesToAdd.push(modAuthorRole.id);
            console.log(`${new Date().toLocaleString()} - ${userData.name} as now a recognised mod author in ${guild.name}`);
            guildMember.send(`Congratulations! You are now a recognised mod author in ${guild.name}!`).catch(() => undefined);
        }
        else if (modAuthorRole && guildMember.roles.cache.has(modAuthorRole.id) && modUniqueTotal < modAuthorDownloads) guildMember.roles.remove(modAuthorRole);

        if (rolesToAdd.length) {
            console.log(`${new Date().toLocaleString()} - Adding ${rolesToAdd.length} roles to ${guildMember.user.tag} (${userData.name}) in ${guild.name}`);
            guildMember.roles.add(rolesToAdd, 'Nexus Mods Discord link')
            .catch(err => console.log(`${new Date().toLocaleString()} - Could not add roles to ${userData.name} in ${guild.name}`, err));
        }

        const links: NexusUserServerLink[] = await getLinksByUser(userData.id);
        const existingLink: NexusUserServerLink|undefined = links.find(l => l.server_id === guild.id);
        if (nexusLogChannel && !existingLink) (nexusLogChannel as TextChannel).send({ embeds: [linkEmbed(userData, discordUser)] }).catch(() => undefined);
        
        return resolve();


    });
}

async function updateAllRoles(client: Client, userData: NexusUser, discordUser: User, addAll: boolean = false): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const servers: BotServer[] = await getAllServers();
        const links: NexusUserServerLink[] = await getLinksByUser(userData.id);
        // console.log(`${new Date().toLocaleString()} - Updating all roles for ${userData.name} (${discordUser.tag})`);
        for(const server of servers) {
            const guild: Guild | undefined = await client.guilds.fetch(server.id).catch(() => undefined);
            const guildMember: GuildMember|undefined = guild ? await guild.members.fetch(discordUser.id).catch(() => undefined) : undefined;
            if (!guildMember) continue;
            const existingLink: boolean = !!links.find(l => l.server_id);
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

const modUniqueDLTotal = (allMods: NexusLinkedMod[]) => {
    let downloads = allMods.reduce((prev, cur) => prev = prev + cur.unique_downloads, 0);
    return downloads;
}

const linkEmbed = (user: NexusUser, discord: User, remove?: boolean): MessageEmbed => {
    const embed = new MessageEmbed()
    .setAuthor(`Account ${remove ? 'Unlinked' : 'Linked'}`, user.avatar_url)
    .setDescription(`${discord.toString()} ${remove ? 'unlinked from' : 'linked to'} [${user.name}](https://nexusmods.com/users/${user.id}).`)
    .setTimestamp(new Date())
    .setColor(0xda8e35)
    .setFooter('🔗 Nexus Mods API link');

    return embed;
}

export { getLinksByUser, addServerLink, deleteServerLink, deleteAllServerLinksByUser, updateRoles, updateAllRoles, modUniqueDLTotal };