import { GameFeed } from '../types/feeds';
import { getAllGameFeeds, getGameFeed, createGameFeed, deleteGameFeed, getUserByDiscordId, getUserByNexusModsName, updateGameFeed } from '../api/bot-db';
import { ClientExt } from '../DiscordBot';
import { IUpdateEntry, IChangelogs, IGameInfo } from '@nexusmods/nexus-api';
import { User, Guild, TextChannel, WebhookClient, GuildMember, Permissions, MessageEmbed, Client } from 'discord.js';
import { NexusUser } from '../types/users';
import { validate, games, updatedMods, modInfo, modChangelogs } from '../api/nexus-discord';
import { IModInfoExt } from '../types/util';

const pollTime: number = (1000*60*10); //10 mins
const timeNew: number = 9000 //How long after publishing a mod is "New" (15mins)

// Temporary storage for game data during the feed update.
let allGames: IGameInfo[] | undefined = undefined;

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
                console.log(`${tn()} - Initialised with ${this.GameFeeds.length} game feeds, checking every ${pollTime/1000/60} minutes`);
                this.updateFeeds().catch((err) => console.warn(`${tn()} - Error updating game feeds`, err));
            })
            .catch((err) => console.error('Error in GameFeedManager contructor', err));
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
        console.log(`${tn()} - Checking for updates in ${manager.GameFeeds.length} game feeds`);

        // TODO! - Do the update for each feed.
        Promise.all(manager.GameFeeds
                .map((feed: GameFeed) => checkForGameUpdates(client, feed)
                    .catch((err: Error) => console.warn(`${tn()} - Error checking game feed`, feed._id, err)))
        )
        .then(() => { 
            console.log(`${tn()} - Finished checking game feeds.`);
            allGames = undefined; 
        });

    }
}

const tn = () => new Date().toLocaleString();

async function checkForGameUpdates(client: ClientExt, feed: GameFeed): Promise<void> {

    // Gather all the setup information.
    const discordUser: User|null = await client.users.fetch(feed.owner)  //resolve(feed.owner);
    const userData: NexusUser = await getUserByDiscordId(feed.owner)
        .catch(() => Promise.reject(`Unable to find user data for ${discordUser}`));
    const guild: Guild|null = client.guilds.resolve(feed.guild);
    const channel: TextChannel|null = guild ? (guild.channels.resolve(feed.channel) as TextChannel) : null;
    const webHook: WebhookClient = new WebhookClient(feed.webhook_id || '', feed.webhook_token || '');
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
        if (err.includes('401')) {
            if (client.config.testing) return;
            await deleteGameFeed(feed._id);
            if (discordUser) discordUser.send(`Cancelled Game Feed for ${feed.title} in ${guild?.name} as your API key is invalid`).catch(() => undefined);
            return Promise.reject('User API ket invalid.');
        }
        else return Promise.reject(`An error occurred when validing game key for ${userData.name}: ${err.message || err}`);
    }

    // Get all the games if we need them.
    if (!allGames) allGames = await games(userData, false);

    // Get the data for the game we're checking.
    const game: IGameInfo|undefined = allGames.find(g => g.domain_name === feed.domain);

    if (!game) return Promise.reject(`Unable to retrieve game info for ${feed.title}`);

    // Get the updated mods for this game.
    try {
        const newMods: IUpdateEntry[] = await updatedMods(userData, feed.domain, '1w');
        // Filter out the mods from before our saved timestamp.
        const lastUpdateEpoc = Math.floor(feed.last_timestamp.getTime() /1000);
        const filteredMods = newMods.filter(mod => mod.latest_file_update > lastUpdateEpoc).sort(compareDates);
        if (!filteredMods.length) {
            // console.log(`${tn()} - No unchecked updates for ${feed.title} in ${guild?.name} (#${feed._id})`);
            return;
        }

        let modEmbeds: MessageEmbed[] = [];
        let lastUpdate: Date = feed.last_timestamp;

        // Interate through the mods and build embeds.
        for (const mod of filteredMods) {
            // Stop if we have 10 embeds.
            if (modEmbeds.length >= 10) break;
            const modData: IModInfoExt|undefined = await modInfo(userData, feed.domain, mod.mod_id).catch((e) => {console.error(e); return undefined});

            // Stop if we failed to get the mod data.
            if (!modData) continue;

            // Reocord the file update time, we'll need thi later.
            const updateTime = new Date(mod.latest_file_update * 1000);

            // Ignore mods that aren't public.
            if (modData.status !== 'published') continue;

            // Skip if adult content is disabled and the mod is adult and vice versa.
            if (modData.contains_adult_content && !feed.nsfw) continue;
            if (!modData.contains_adult_content && !feed.sfw) continue;

            // If the mod author is in this server, get their Discord handle.
            const authorData: NexusUser|undefined = await getUserByNexusModsName(modData.uploaded_by).catch(() => undefined);
            modData.authorDiscord = guild && authorData ? guild.members.resolve(authorData?.d_id) : null;

            // Determine if this a new or updated mod and build the embed.
            if ((modData.updated_timestamp - modData.created_timestamp) < timeNew && feed.show_new) {
                modEmbeds.push(createModEmbed(client, modData, game, true, undefined, feed.compact));
                lastUpdate = updateTime;
            }
            else if (feed.show_updates) {
                const changelog: IChangelogs|undefined = await modChangelogs(userData, feed.domain, mod.mod_id).catch(() => undefined);
                modEmbeds.push(createModEmbed(client, modData, game, false, changelog, feed.compact));
                lastUpdate = updateTime;
            }
        }
        if (lastUpdate > feed.last_timestamp) await updateGameFeed(feed._id, { last_timestamp: lastUpdate})
            .catch(() => { Promise.reject(`Failed to update timestamp`) });
        
        // Nothing to post?
        if (!modEmbeds.length) { 
            // console.log(`${tn()} - No matching updates for ${feed.title} in ${guild?.name} (#${feed._id})`)
            return;
        };

        console.log(`${tn()} - Posting ${modEmbeds.length} updates for ${feed.title} in ${guild?.name} (#${feed._id})`)

        webHook.send(feed.message, {embeds: modEmbeds, split: true}).catch(() => {
            if (feed.message) channel?.send(feed.message).catch(() => undefined);
            modEmbeds.forEach(mod => channel?.send(mod).catch(() => undefined));
        });
        
    }
    catch(err) {
        return Promise.reject(`Error processing game feed ${err}`);
    }


}


function createModEmbed(client: Client,
                        mod: IModInfoExt, 
                        game: IGameInfo, 
                        newMod: boolean, 
                        changeLog: IChangelogs|undefined, 
                        compact: boolean): MessageEmbed {
    const gameThumb: string = `https://staticdelivery.nexusmods.com/Images/games/4_3/tile_${game.id}.jpg`;
    const category: string = game.categories.find(c => c.category_id === mod.category_id)?.name || 'Unknown';
    const uploaderProfile: string = `https://nexusmods.com/${game.domain_name}/users/${mod.user.member_id}`;

    let post = new MessageEmbed()
    .setAuthor(`${newMod ? 'New Mod Upload' : 'Updated Mod'} (${game.name})`, client.user?.avatarURL() || '')
    .setTitle(mod.name || 'Name not found')
    .setColor(newMod ? 0xda8e35 : 0x57a5cc)
    .setURL(`https://www.nexusmods.com/${mod.domain_name}/mods/${mod.mod_id}`)
    .setDescription(sanitiseBreaks(mod.summary || 'No summary'))
    .setImage(!compact? mod.picture_url || '' : '')
    .setThumbnail(compact ? mod.picture_url || '' : gameThumb)
    if (changeLog && Object.keys(changeLog).find(id => mod.version === id)) {
        let versionChanges = changeLog[mod.version].join("\n");
        if (versionChanges.length > 1024) versionChanges = versionChanges.substring(0,1020)+"..."
        post.addField(`Changelog (v${mod.version})`, versionChanges);
    }
    post.addField('Author', mod.author, true)
    .addField('Uploader', `[${mod.uploaded_by}](${uploaderProfile})`, true)
    if (mod.authorDiscord) post.addField('Discord', mod.authorDiscord.toString(), true)
    if (!compact) post.addField('Category', category, true)
    post.setTimestamp(new Date(mod.updated_time))
    .setFooter(`${game.name}  •  ${category}  • v${mod.version} `, client?.user?.avatarURL() || '');

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