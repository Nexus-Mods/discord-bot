import { GameFeed } from '../types/feeds';
import { getAllGameFeeds, getGameFeed, createGameFeed, deleteGameFeed, getUserByDiscordId, getUserByNexusModsName, updateGameFeed } from '../api/bot-db';
import { ClientExt } from "../types/util";
import { IUpdateEntry, IChangelogs, IGameInfo } from '@nexusmods/nexus-api';
import { User, Guild, TextChannel, WebhookClient, GuildMember, Permissions, MessageEmbed, Client } from 'discord.js';
import { NexusUser } from '../types/users';
import { validate, games, updatedMods, modChangelogs } from '../api/nexus-discord';
import { IModInfoExt } from '../types/util';
import { logMessage } from '../api/util';
import { NexusModsGQLClient } from '../api/NexusModsGQLClient';
import * as GQLTypes from '../types/GQLTypes';

const pollTime: number = (1000*60*10); //10 mins
const timeNew: number = 900 //How long after publishing a mod is "New" (15mins)

// Temporary storage for game data during the feed update.
let allGames: IGameInfo[] = [];

export class GameFeedManager {
    private static instance: GameFeedManager;

    private GameFeeds: GameFeed[] = [];
    private client: ClientExt;
    private updateTimer: NodeJS.Timeout;

    static getInstance(client: ClientExt): GameFeedManager {
        if (!GameFeedManager.instance) {
            GameFeedManager.instance = new GameFeedManager(client);
        }

        return GameFeedManager.instance;
    }

    private constructor(client: ClientExt) {
        // Save the client for later
        this.client = client;
        // Set the update interval.
        this.updateTimer = setInterval(this.updateFeeds, pollTime);
        this.getFeeds()
            .then(() => {
                logMessage(`Initialised with ${this.GameFeeds.length} game feeds, checking every ${pollTime/1000/60} minutes`);
                this.updateFeeds().catch((err) => logMessage(`Error updating game feeds`, err, true));
            })
            .catch((err) => logMessage('Error in GameFeedManager contructor', err, true));
    }

    private async getFeeds(): Promise<GameFeed[]> {
        (GameFeedManager.instance || this).GameFeeds = await getAllGameFeeds();
        return (GameFeedManager.instance || this).GameFeeds;
    }

    async updateAll(): Promise<void> {
        const mgr = GameFeedManager.instance;
        await mgr.getFeeds();
        await mgr.updateFeeds();
        clearInterval(mgr.updateTimer);
        mgr.updateTimer = setInterval(mgr.updateFeeds, pollTime);
    }

    getAllFeeds(): GameFeed[] {
        return GameFeedManager.instance.GameFeeds;
    }

    async getFeed(id: number): Promise<GameFeed | undefined> {
        const mgr = GameFeedManager.instance;
        const feed = mgr.GameFeeds.find((f: GameFeed) => f._id === id);
        return feed || await getGameFeed(id);
    }

    async create(newFeed: GameFeed): Promise<number> {
        try {
            const id = await createGameFeed(newFeed);
            return id;
        }
        catch (err) {
            return await Promise.reject(err);
        }
    }

    async deleteFeed(id: number): Promise<void> {
        const mgr = GameFeedManager.instance;
        const feed = mgr.GameFeeds.find((f: GameFeed) => f._id === id);
        if (!feed) return Promise.resolve();
        await deleteGameFeed(feed._id);
        await mgr.getFeeds();
        return;
    }

    async updateFeeds(): Promise<void> {
        const manager: GameFeedManager = GameFeedManager.instance;
        await manager.getFeeds();
        const client: ClientExt = manager.client;
        if (!manager.GameFeeds.length) return logMessage('No game feeds, update check skipped');
        logMessage(`Checking for updates in ${manager.GameFeeds.length} game feeds`);

        // TODO! - Do the update for each feed.
        for (const feed of manager.GameFeeds) {
            try {
                await checkForGameUpdates(client, feed);
            }
            catch(err) {
                logMessage(`UpdateFeeds(): Error checking game feed ${feed._id}`, err, true);
            }
        }

        logMessage('Finished checking game feeds.');
        allGames = [];

        // Create a heap snapshot
        try {

            let nodeOomHeapdump = await require("node-oom-heapdump")({
                heapdumpOnOOM: false,
                port: 9228
              });
            await nodeOomHeapdump.deleteAllHeapSnapshots();
            await nodeOomHeapdump.createHeapSnapshot('gameFeedHeapDump');
        }
        catch(err) {
            logMessage('Could not create a heap snapshot', {err});
        }
    }
}

async function checkForGameUpdates(client: ClientExt, feed: GameFeed): Promise<void> {

    // Gather all the setup information.
    const discordUser: User|null = await client.users.fetch(feed.owner)  //resolve(feed.owner);
    const userData: NexusUser = await getUserByDiscordId(feed.owner)
        .catch(() => Promise.reject(`Unable to find user data for ${discordUser}`));
    const guild: Guild|null = client.guilds.resolve(feed.guild);
    const channel: TextChannel|null = guild ? (guild.channels.resolve(feed.channel) as TextChannel) : null;
    let webHook: WebhookClient | undefined = undefined;
    if (feed.webhook_id && feed.webhook_token) webHook = new WebhookClient({id: feed.webhook_id, token: feed.webhook_token});
    const botMember: GuildMember|null = guild ? guild.me : null;
    const botPerms: Readonly<Permissions>|null|undefined = botMember ? channel?.permissionsFor(botMember) : null;

    // console.log(`${tn()} - Checking game feed #${feed._id} for updates (${feed.title}) in ${guild?.name}`);

    // If we can't reach the feed owner. 
    if (!discordUser || !userData) {
        if (client.config.testing) return;
        await deleteGameFeed(feed._id);
        if (channel) channel.send(`Cancelled feed for ${feed.title} in this channel as I can no longer reach the user who set it up. Discord <@${feed.owner}>, Nexus: ${userData?.name || '???' }`).catch(() => undefined);
        return Promise.reject(`Deleted game update #${feed._id} (${feed.title}) due to missing guild or channel data. Discord user: ${discordUser} Nexus User: ${userData?.name || '???' }`);
    }

    // Check for relevant permissions.
    if (botPerms && !botPerms.has('SEND_MESSAGES', true)) {
        if (client.config.testing) return;
        await deleteGameFeed(feed._id);
        if (discordUser) discordUser.send(`I'm not able to post ${feed.title} updates to ${channel || 'unknown channel'} in ${guild || 'unknown guild'} anymore as I do not seem to have permission to post there. The feed has been cancelled.`).catch(() => undefined);
        return Promise.reject(`Can't process game update #${feed._id} (${feed.title}) due to missing permissions. Deleted feed.`);
    }

    // Check if the channel or guild is missing.
    if (discordUser && (!guild || !channel)) {
        if (client.config.testing) return;
        await deleteGameFeed(feed._id);
        discordUser.send(`I'm not able to post ${feed.title} updates to ${channel || 'missing channel'} in ${guild?.name || 'missing guild'} anymore as the channel or server could not be found. Game feed cancelled.`).catch(() => undefined);
        return Promise.reject(`Server ${guild?.name} or channel ${channel} could not be reached.`);
    }

    // Validate the API key
    try {
        await validate(userData.apikey);
    }
    catch(err) {
        if ((err as any).includes('401')) {
            if (client.config.testing) return;
            await deleteGameFeed(feed._id);
            if (discordUser) discordUser.send(`Cancelled Game Feed for ${feed.title} in ${guild?.name} as your API key is invalid`).catch(() => undefined);
            return Promise.reject('User API ket invalid.');
        }
        else return Promise.reject(`An error occurred when validing game key for ${userData.name}: ${(err as Error).message || err}`);
    }

    // Get all the games if we need them.
    if (!allGames.length) allGames = await games(userData, true);

    // Get the data for the game we're checking.
    const game: IGameInfo|undefined = allGames.find(g => g.domain_name === feed.domain);

    if (!game) {
        // logMessage(`Unable to retrieve game info for ${feed.title}`, { id: feed._id, guild: guild?.name }, true);
        return Promise.reject(`Unable to retrieve game info for ${feed.title}. id: ${feed._id}, guild: ${guild?.name}`);
    };

    // Get the updated mods for this game.
    try {
        const newMods: IUpdateEntry[] = await updatedMods(userData, feed.domain, '1w');
        // Filter out the mods from before our saved timestamp.
        const lastUpdateEpoc = Math.floor(feed.last_timestamp.getTime() /1000);
        const filteredMods = newMods.filter(mod => mod.latest_file_update > lastUpdateEpoc).sort(compareDates);
        // No mods to show
        if (!filteredMods.length) return;

        let modEmbeds: MessageEmbed[] = [];
        let lastUpdate: Date = feed.last_timestamp;

        let rateLimited: boolean = false;

        // Using GQL for requests instead of doing it one at a time.
        const nexusGQL = new NexusModsGQLClient(userData);
        const modsToCheck = filteredMods.map(m => ({ gameDomain: feed.domain, modId: m.mod_id }));
        let modMeta: Partial<GQLTypes.FeedMod>[] = await nexusGQL.modInfo(modsToCheck);

        // Add in the last file update time, as we'll need this and it isn't in GQL yet
        modMeta = modMeta.map(m => {
            const newMod = newMods.find(n => n.mod_id === m.modId);
            if (newMod && newMod.latest_file_update) {
                m.lastFileUpdate = newMod.latest_file_update;
            }
            return m;
        });

        // Interate through the mods and build embeds.
        for (const mod of modMeta) {
            // If we've been rate limited, there's no point in continuing here:
            if (rateLimited) break;
            // Stop if we have 10 embeds.
            if (modEmbeds.length >= 10) break;
            // Stop if we failed to get the mod data.
            if (!mod) continue;

            // Record the file update time, we'll need this later. Was last file update, but GQL doesn't have this!
            const updateTime = new Date((mod.lastFileUpdate || 0) * 1000);

            // Ignore mods that aren't public.
            if (mod.status !== 'published') continue;

            // Skip if adult content is disabled and the mod is adult and vice versa.
            if ((mod.adult && !feed.nsfw) || (!mod.adult && !feed.sfw)) continue;

            // If the mod author is in this server, get their Discord handle.
            const authorData: NexusUser|undefined = await getUserByNexusModsName(mod.uploader?.name || '').catch(() => undefined);
            (mod as GQLTypes.FeedMod ).authorDiscord = guild && authorData ? guild.members.resolve(authorData?.d_id) : null;

            // Determine if this a new or updated mod and build the embed.
            const timeDiff: number = (new Date (mod.updatedAt || 0)?.getTime()) - (new Date (mod.createdAt || 0)?.getTime());
            if (timeDiff < timeNew && feed.show_new) {
                const embed: MessageEmbed = createModEmbedGQL(client, mod as GQLTypes.FeedMod, game, true, undefined, feed.compact);
                modEmbeds.push(embed);
                lastUpdate = updateTime;
            }
            else if (feed.show_updates) {
                const changelog: IChangelogs|undefined = await modChangelogs(userData, feed.domain, mod.modId || 0).catch(() => undefined);
                const embed: MessageEmbed = createModEmbedGQL(client, mod as GQLTypes.FeedMod, game, false, changelog, feed.compact)
                modEmbeds.push(embed);
                lastUpdate = updateTime;
            }

        }

        if (lastUpdate > feed.last_timestamp) await updateGameFeed(feed._id, { last_timestamp: lastUpdate})
            .catch(() => { Promise.reject(`Failed to update timestamp`) });
        // else logMessage('Did not update feed date', { lastUpdate, feed: feed.last_timestamp });
        
        // Nothing to post?
        if (!modEmbeds.length) { 
            // console.log(`${tn()} - No matching updates for ${feed.title} in ${guild?.name} (#${feed._id})`)
            return;
        };

        logMessage(`Posting ${modEmbeds.length} updates for ${feed.title} in ${guild?.name} (#${feed._id})`);

        if (webHook) webHook.send({ embeds: modEmbeds, content: feed.message }).catch(() => {
            if (feed.message) channel?.send(feed.message).catch(() => undefined);
            modEmbeds.forEach(mod => channel?.send({ embeds: [mod] }).catch(() => undefined));
        });
        else {
            if (feed.message) channel?.send(feed.message).catch(() => undefined);
            modEmbeds.forEach(mod => channel?.send({ embeds: [mod] }).catch(() => undefined));
        }
        
    }
    catch(err) {
        const error: string = (err as Error)?.message || (err as string);
        if (error.indexOf('Nexus Mods API responded with 429.') !== -1) {
            logMessage('Failed to process game feed due to rate limiting', { name: userData.name, id: feed._id, guild: guild?.name });
            return;
        }
        return Promise.reject(err);
    }


}


function createModEmbed(client: Client,
                        mod: IModInfoExt, 
                        game: IGameInfo, 
                        newMod: boolean, 
                        changeLog: IChangelogs|undefined, 
                        compact: boolean): MessageEmbed {
    const gameThumb: string = `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`;
    const category: string = game.categories?.find(c => c.category_id === mod.category_id)?.name || 'Unknown';
    const uploaderProfile: string = `https://nexusmods.com/${game.domain_name}/users/${mod.user.member_id}`;

    let post = new MessageEmbed()
    .setAuthor({name:`${newMod ? 'New Mod Upload' : 'Updated Mod'} (${game.name})`, iconURL: client.user?.avatarURL() || '' })
    .setTitle(mod.name || 'Name not found')
    .setColor(newMod ? 0xda8e35 : 0x57a5cc)
    .setURL(`https://www.nexusmods.com/${mod.domain_name}/mods/${mod.mod_id}`)
    .setDescription(sanitiseBreaks(mod.summary || 'No summary'))
    .setImage(!compact? mod.picture_url || '' : '')
    .setThumbnail(compact ? mod.picture_url || '' : gameThumb)
    if (changeLog && Object.keys(changeLog).find(id => mod.version === id)) {
        let versionChanges = changeLog[mod.version].join("\n").replace('<br />', '');
        if (versionChanges.length > 1024) versionChanges = versionChanges.substring(0,1020)+"..."
        post.addField(`Changelog (v${mod.version})`, versionChanges);
    }
    post.addField('Author', mod.author, true)
    .addField('Uploader', `[${mod.uploaded_by}](${uploaderProfile})`, true)
    if (mod.authorDiscord) post.addField('Discord', mod.authorDiscord.toString(), true)
    if (!compact) post.addField('Category', category, true)
    post.setTimestamp(new Date(mod.updated_time))
    .setFooter({ text: `${game.name}  •  ${category}  • v${mod.version} `, iconURL: client?.user?.avatarURL() || '' });

    return post;

}

function createModEmbedGQL(client: Client,
    mod: GQLTypes.FeedMod, 
    game: IGameInfo, 
    newMod: boolean, 
    changeLog: IChangelogs|undefined, 
    compact: boolean): MessageEmbed {
const gameThumb: string = `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`;
const category: string = mod.modCategory.name || 'Unknown';
const uploaderProfile: string = `https://nexusmods.com/${game.domain_name}/users/${mod.uploader.memberId}`;

let post = new MessageEmbed()
.setAuthor({name:`${newMod ? 'New Mod Upload' : 'Updated Mod'} (${game.name})`, iconURL: client.user?.avatarURL() || '' })
.setTitle(mod.name || 'Name not found')
.setColor(newMod ? 0xda8e35 : 0x57a5cc)
.setURL(`https://www.nexusmods.com/${mod.game.domainName}/mods/${mod.modId}`)
.setDescription(sanitiseBreaks(mod.summary || 'No summary'))
.setImage(!compact? mod.pictureUrl || '' : '')
.setThumbnail(compact ? mod.pictureUrl || '' : gameThumb)
if (changeLog && Object.keys(changeLog).find(id => mod.version === id)) {
let versionChanges = changeLog[mod.version].join("\n").replace('<br />', '');
if (versionChanges.length > 1024) versionChanges = versionChanges.substring(0,1020)+"..."
post.addField(`Changelog (v${mod.version})`, versionChanges);
}
post.addField('Author', mod.author, true)
.addField('Uploader', `[${mod.uploader?.name}](${uploaderProfile})`, true)
if (mod.authorDiscord) post.addField('Discord', mod.authorDiscord.toString(), true)
if (!compact) post.addField('Category', category, true)
post.setTimestamp(new Date(mod.updatedAt))
.setFooter({ text: `${game.name}  •  ${category}  • v${mod.version} `, iconURL: client?.user?.avatarURL() || '' });

return post;

}


function compareDates(a: IUpdateEntry, b: IUpdateEntry): number {
    if (a.latest_file_update > b.latest_file_update) return 1
    else if (a.latest_file_update < b.latest_file_update)  return -1
    return 0;
}

function sanitiseBreaks(string: string): string {
    while (string.indexOf("<br />") !== -1) {
        string = string.replace("<br />",'\n');
    };
    return string;
}