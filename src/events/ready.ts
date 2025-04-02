import { EmbedBuilder, Guild, TextChannel, GuildBasedChannel } from 'discord.js';
import { getAllServers, deleteServer } from '../api/bot-db';
import { BotServer } from '../types/servers';
import { Logger } from '../api/util';
import { DiscordEventInterface, ClientExt } from '../types/DiscordTypes';

import { GameListCache } from '../types/util';

// Prepare the online status embed for quick reuse.
const onlineEmbed = new EmbedBuilder()
.setTitle('Nexus Mods Discord Bot is online.')
.setColor(0x009933);

const main: DiscordEventInterface = {
    name: 'ready',
    once: true,
    async execute(client: ClientExt, logger: Logger) {
        if (client.user?.username !== "Nexus Mods") client.user?.setUsername("Nexus Mods");

        // Pre-cache games list
        try {
            client.gamesList = await new GameListCache().init(logger);
        }
        catch(err) {
            logger.warn('Could not pre-cache the games list', err);
        }

        // Publish online message to servers. (Cache server listing?)
        if (client.config.testing) {
            logger.debug('Testing mode - did not send online message');
            logger.info(`v${process.env.npm_package_version} Startup complete. Ready to serve in ${client.guilds.cache.size} servers.`);
            client.emit('readyForAction');
            return;
        }

        try {
            // Set the startup time
            onlineEmbed.setTimestamp(new Date());
            // Get all known servers
            const servers: BotServer[] = await getAllServers().catch(() => []);
            for (const server of servers) {
                // Check the server still exists (i.e. we are a member)
                const guild: Guild | undefined = await client.guilds.fetch(server.id).catch(() => undefined);
                if (!guild) {
                    logger.info(`Deleting non-existent server: ${server.id}`);
                    await deleteServer(server.id).catch((err) => logger.warn('Could not delete server', err));
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
                        logger.warn(`Error posting online notice to log channel in ${guild.name}`, { error: (err as Error).message });
                    }
                }
            }

        }
        catch(err) {
            logger.warn('Sending online message failed', err);

        }

        logger.info(`v${process.env.npm_package_version} Startup complete. Ready to serve in ${client.guilds.cache.size} servers.`);
        client.emit('readyForAction');

    }
}

export default main;