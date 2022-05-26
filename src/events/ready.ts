import { ClientExt } from '../types/util';
import { GameFeedManager } from '../feeds/GameFeedManager';
import { MessageEmbed, Guild, GuildChannel, TextChannel, Snowflake, ThreadChannel } from 'discord.js';
import { getAllServers, deleteServer } from '../api/bot-db';
import { BotServer } from '../types/servers';
import { ModFeedManager } from '../feeds/ModFeedManager';
import { NewsFeedManager } from '../feeds/NewsFeedManager';
import { logMessage } from '../api/util';

// Prepare the online status embed for quick reuse.
const onlineEmbed = new MessageEmbed()
    .setTitle(`Nexus Mods Discord Bot v${process.env.npm_package_version} is online.`)
    .setColor(0x009933);

let firstStartUp: boolean = false;

async function main (client: ClientExt) {
    client.user?.setActivity({name: 'for slash commands', type: 'WATCHING', url: "https://discord.gg/nexusmods"});
    if (client.user?.username !== "Nexus Mods") client.user?.setUsername("Nexus Mods");

    if (firstStartUp) return;

    // Start up the feeds
    const gameFeeds: GameFeedManager = GameFeedManager.getInstance(client);
    const modFeeds: ModFeedManager = ModFeedManager.getInstance(client);
    const newsFeed: NewsFeedManager = NewsFeedManager.getInstance(client);

    // Publish online message to servers. (Cache server listing?)
    if (client.config.testing) return logMessage('Testing mode - did not send online message');
    const allServers: BotServer[] = await getAllServers()
        .catch((err) => {
            logMessage('Error getting all servers when publishing online message.', err, true);
            return [];
        });
    for (let server of allServers) {
        const guild: Guild | undefined = await client.guilds.fetch(server.id).catch(() => undefined);
        if (!guild) {
            // We don't want to delete anything by mistake when testing. 
            if (!client.config.testing) {
                await deleteServer(server.id);
                logMessage(`Deleting non-existant server: ${server.id}`);
            };
            continue;
        }
        if ((server as BotServer).channel_nexus) {
            const channelId: Snowflake | undefined = (server as BotServer).channel_nexus
            if (!channelId) continue;
            const postChannel: GuildChannel | ThreadChannel | null = guild.channels.resolve(channelId);
            if (!postChannel) {
                logMessage(`Could not get Nexus Log channel for ${guild}`);
                continue;
            };            
            onlineEmbed.setTimestamp(new Date());
            (postChannel as TextChannel).send({embeds: [onlineEmbed]})
                .catch((err) => {
                    if (['Missing Permissions', 'Missing Access'].includes(err.message)) logMessage(
                        `Error posting online notice to log channel in ${guild.name}`, { error: err.message }, true
                    );
                })
        }
    }

    logMessage(`v${process.env.npm_package_version} Startup complete. Ready to serve in ${client.guilds.cache.size} servers.`);

}

export default main;