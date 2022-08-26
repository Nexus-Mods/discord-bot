import { GameFeedManager } from '../feeds/GameFeedManager';
import { EmbedBuilder, Guild, TextChannel, ActivityType, NonThreadGuildBasedChannel } from 'discord.js';
import { getAllServers, deleteServer } from '../api/bot-db';
import { BotServer } from '../types/servers';
import { ModFeedManager } from '../feeds/ModFeedManager';
import { NewsFeedManager } from '../feeds/NewsFeedManager';
import { logMessage } from '../api/util';
import { DiscordEventInterface, ClientExt } from '../types/DiscordTypes';

// Prepare the online status embed for quick reuse.
const onlineEmbed = new EmbedBuilder()
.setTitle('Nexus Mods Discord Bot is online.')
.setColor(0x009933);

const main: DiscordEventInterface = {
    name: 'ready',
    once: true,
    async execute(client: ClientExt) {
        client.user?.setActivity({ name: 'for slash commands', type: ActivityType.Watching, url: 'https://discord.gg/nexusmods' });
        if (client.user?.username !== "Nexus Mods") client.user?.setUsername("Nexus Mods");

        // Start up the feeds
        client.gameFeeds = GameFeedManager.getInstance(client);
        client.modFeeds = ModFeedManager.getInstance(client);
        client.newsFeed = NewsFeedManager.getInstance(client);

        // Publish online message to servers. (Cache server listing?)
        if (client.config.testing) return logMessage('Testing mode - did not send online message');

        try {
            // Set the startup time
            onlineEmbed.setTimestamp(new Date());
            // Get all known servers
            const servers: BotServer[] = await getAllServers().catch(() => []);
            for (const server of servers) {
                // Check the server still exists (i.e. we are a member)
                const guild: Guild | undefined = await client.guilds.fetch(server.id).catch(() => undefined);
                if (!guild) {
                    logMessage(`Deleting non-existant server: ${server.id}`);
                    await deleteServer(server.id).catch((err) => logMessage('Could not delete server', err, true));
                    continue;
                }
                if (!server.channel_nexus) continue;
                const postChannel: NonThreadGuildBasedChannel | null = await guild.channels.fetch(server.channel_nexus).catch(() => null);
                // If the channel couldn't be resolved or we can't send messages.
                if (!postChannel || !(postChannel as TextChannel).send) continue;
                try {
                    await (postChannel as TextChannel).send({ embeds: [onlineEmbed] });
                }
                catch(err) {
                    if (!['Missing Permissions', 'Missing Access'].includes((err as Error).message)) {
                        logMessage(`Error posting online notice to log channel in ${guild.name}`, { error: (err as Error).message }, true);
                    }
                }
            }

        }
        catch(err) {
            logMessage('Sending online message failed', err, true);

        }

        logMessage(`v${process.env.npm_package_version} Startup complete. Ready to serve in ${client.guilds.cache.size} servers.`);

    }
}

export default main;