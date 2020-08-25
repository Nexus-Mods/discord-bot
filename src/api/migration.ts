const Enmap = require("enmap");
const { query } = require('./dbConnect.js');
const { getAllGameFeeds, getAllServers, getAllUsers } = require('./bot-db.js');
const nexusAPI = require('../api/nexus-discord.js');
import PromiseBB from "bluebird";
import path from "path";

const oldGameFeeds = new Enmap({
    name: "GameUpdates",
    autoFetch: true,
    fetchAll: true
});

const oldUsers = new Enmap({
    name: "NexusModsDiscordUsers",
    autoFetch: true,
    fetchAll: true
});




exports.migrate = async function migrate(client, admin) {
    let errors = [];
    const allUsers = await getAllUsers();
    const allFeeds = await getAllGameFeeds();
    const allServers = await getAllServers();

    const oldServerConfig = require(path.join(__dirname, '../data/serverconfig.json'));

    console.group('Migration');
    console.log(`Starting Migration of ${oldUsers.count} users, ${oldServerConfig.length || 0} servers and ${oldGameFeeds.count} game feeds`);
    admin.send(`Starting Migration of ${oldUsers.count} users, ${oldServerConfig.length || 0} servers and ${oldGameFeeds.count} game feeds`).catch(() => console.warn);

    return PromiseBB.mapSeries(oldUsers.indexes, async (index, key) => {
        const user = oldUsers.get(index);

        if (allUsers.find(u => u.id === user.nexusID)) {
            console.log(`Skipping user ${user.nexusName} because they already exist.`);
            return;
        }

        const apiData = await nexusAPI.validate(user.apikey).catch(() => {
            console.log(`Skipping user ${user.nexusName} because their API key isn't valid.`);
            return;
        });

        console.log(`Importing user: ${user.nexusName}`);

        const discordUser = client.users.get(u => u.id === index);

        let newUser = {
            d_id: discordUser ? discordUser.id : index,
            id: apiData ? apiData.user_id : user.nexusID,
            name: apiData ? apiData.name : user.nexusName,
            avatar_url: apiData ? apiData.profile_url : user.avatarURL,
            apikey: apiData ? apiData.key : user.apikey,
            supporter: apiData ? (!apiData.is_premium && apiData.is_supporter) : user.nexusSupporter,
            premium: apiData ? apiData.is_premium : user.nexusPremium,
            lastUpdate: new Date()                                        
        }

        let serverLinks = user.serversLinked ? user.serversLinked.map(s => { return {user_id: newUser.d_id, server_id: s} }) : [];
        if (!user.mods) user.mods = [];
        return PromiseBB.all(user.mods.map((m: any): any => {
            // name, downloads, game, domain, modid, url
            return nexusAPI.getDownloads(newUser, m.domain, -1, m.modid).catch(() => console.warn)
            .then((dls) => {
                return {
                    domain: m.domain,
                    mod_id: m.modid,
                    name: m.name,
                    game: m.game,
                    unique_downloads: dls ? dls.unique_downloads : m.downloads,
                    total_downloads: dls ? dls.total_downloads : m.downloads,
                    path: (m.url.substring(m.url.indexOf(m.domain), m.url.length)),
                    owner: newUser.id
                }
            });
        })).then((mods) => {
            if (!mods) return; //No user

            insertToDB(newUser, 'users');
            serverLinks.map(l => {
                console.log(`Importing Link: ${newUser.name} in ${l.server_id}`);
                return insertToDB(l, 'user_servers')
            });
            mods.map((m: any) => {
                console.log(`Importing Mod: ${m.name} for ${m.game}`);
                return insertToDB(m, 'user_mods');
            });
        });
    }).then(() => {
        console.log('Done Importing users');
        return PromiseBB.map(oldGameFeeds.indexes, (index, key) => {
            const feed = oldGameFeeds.get(index);
            if (allFeeds.find(f => f.guild === feed.guild && f.owner === feed.user && f.created === new Date(feed.created*1000))) {
                console.log(`Skipping feed ${feed.gameTitle} #${index} because it already exists.`);
                return;
            }

            // channel, webhook_id, webhook_token, guild, user, game, gameTitle, settings (nsfw, sfw, newMods, updatedMods), lastTimestamp, created
            console.log(`Importing feed: ${feed.gameTitle} #${index}`);

            let newFeed = {
                channel: feed.channel,
                guild: feed.guild,
                owner: feed.user,
                domain: feed.game,
                title: feed.gameTitle,
                nsfw: feed.settings ? feed.settings.nsfw : false,
                sfw: feed.settings ? feed.settings.sfw : true,
                show_new: feed.settings ? feed.settings.newMods : true,
                show_updates: feed.settings ? feed.settings.updatedMods : true,
                webhook_id: feed.webhook_id,
                webhook_token: feed.webhook_token,
                created: new Date(feed.created*1000),
                last_timestamp: new Date()
            };
            return insertToDB(newFeed, 'game_feeds');

        }).then(() => {
            console.log('Done importing feeds');
            if (!oldServerConfig) return [];
            return PromiseBB.map(oldServerConfig, (server: any) => {
                if (allServers.find(s => s.id === server.id)) {
                    console.log(`Skipping server ${server.name} because it already exists.`);
                    return;
                }

                console.log(`Importing server: ${server.name}`);
                const serverData = client.guilds.find(g => g.id === server.id);
                const newServer = {
                    id: server.id,
                    official: server.official,
                    role_linked: server.linkedRole || null,
                    role_premium: server.PremiumRole || null,
                    role_author: server.modAuthorRole || null,
                    author_min_downloads: server.modAuthorDownloadMinimum || 1000,
                    channel_log: server.logChannel || null,
                    channel_bot: server.defaultChannel || null,
                    channel_nexus: server.nexusLogChannel || null,
                    channel_news: server.announcementChannel || null,
                    search_whid: server.webhookID || null,
                    search_whtoken: server.webhookToken || null,
                    game_filter: null,
                    server_owner: serverData ? serverData.ownerID : 'placedholder',
                }
                return insertToDB(newServer, 'servers', true);
            }).then(() => {
                console.log('Done importing servers');
                return errors;
            });
        })
    });
}

function insertToDB(object, tableName, cleanO = false) {
    const cleanObj = cleanO ? clean(object) : object;

    let keys = Object.keys(cleanObj);
    let values = keys.map(k => cleanObj[k]);
    let placeHolders = keys.map((k, idx) => `$${idx + 1}`);

    const queryString = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeHolders.join(', ')})`;

    return query(queryString, values, (err, result) => err ? console.warn(queryString, err, values): undefined);

}

function clean(object) {
    let clean = {};
    Object.keys(object).map(k => !!object[k] ? clean[k] = object[k] : null);
    return clean;    
}