import { EmbedBuilder, Guild, TextChannel, GuildBasedChannel } from 'discord.js';
import { getAllServers, deleteServer } from '../api/bot-db';
import { BotServer } from '../types/servers';
import { logMessage } from '../api/util';
import { DiscordEventInterface, ClientExt } from '../types/DiscordTypes';

import { NewsFeedManager } from '../feeds/NewsFeedManager';
import { GameFeedManager } from '../feeds/GameFeedManager';
import { AutoModManager } from '../feeds/AutoModManager';
import { GameListCache } from '../types/util';
import { SubscriptionManger } from '../feeds/SubscriptionManager';

// Prepare the online status embed for quick reuse.
const onlineEmbed = new EmbedBuilder()
.setTitle('Nexus Mods Discord Bot is online.')
.setColor(0x009933);

const main: DiscordEventInterface = {
    name: 'ready',
    once: true,
    async execute(client: ClientExt) {
        if (client.user?.username !== "Nexus Mods") client.user?.setUsername("Nexus Mods");

        // Pre-cache games list
        try {
            client.gamesList = await new GameListCache().init();
        }
        catch(err) {
            logMessage('Could not pre-cache the games list', err, true);
        }

        // Start up the feeds
        try {
            client.gameFeeds = GameFeedManager.getInstance(client);
            client.newsFeed = await NewsFeedManager.getInstance(client);
            client.automod = AutoModManager.getInstance(client);
            client.subscriptions = await SubscriptionManger.getInstance(client);
        }
        catch(err) {
            logMessage('Error starting up feeds', err, true);
        }

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
                    logMessage(`Deleting non-existent server: ${server.id}`);
                    await deleteServer(server.id).catch((err) => logMessage('Could not delete server', err, true));
                    continue;
                }
                if (!server.channel_nexus) continue;
                const postChannel: GuildBasedChannel | null = await guild.channels.fetch(server.channel_nexus).catch(() => null);
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