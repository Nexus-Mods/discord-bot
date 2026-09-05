import { EmbedBuilder, type Guild, type TextChannel, type GuildBasedChannel} from 'discord.js';
import { BOT_VERSION } from '../version.js';
import { deleteServer, getAllServers } from '@nexusmods/persistence/servers.js';
import type { BotServer } from '@nexusmods/persistence/types/servers.js';
import type { Logger } from "@nexusmods/core/logger.js";
import type { DiscordEventInterface, ClientExt } from '../types/DiscordTypes.js';

import { GameListCache } from '../types/util.js';
import { ownsGuild } from '../lib/sharding.js';

const main: DiscordEventInterface = {
    name: 'clientReady',
    once: true,
    async execute(client: ClientExt, logger: Logger) {
        if (client.user?.username !== "Nexus Mods") {
            await client.user?.setUsername("Nexus Mods")
                .catch((err) => logger.warn('Could not set the bot username', err));
        }

        // DiscordBot.connect() already primes this; only retry if that failed.
        try {
            // eslint-disable-next-line require-atomic-updates
            if (!client.gamesList) client.gamesList = await new GameListCache().init(logger);
        }
        catch(err) {
            logger.warn('Could not pre-cache the games list', err);
        }

        // Publish online message to servers. (Cache server listing?)
        if (client.config?.testing) {
            logger.debug('Testing mode - did not send online message');
            logger.info(`v${BOT_VERSION} Startup complete. Ready to serve in ${client.guilds.cache.size} servers.`);
            client.emit('readyForAction');
            return;
        }

        try {
            // Built here rather than at module scope, where it was a shared mutable
            // object whose timestamp was set before being sent to every guild.
            const onlineEmbed = new EmbedBuilder()
            .setTitle('Nexus Mods Discord Bot is online.')
            .setColor(0x009933)
            .setTimestamp(new Date());
            // Get all known servers
            const servers: BotServer[] = await getAllServers().catch(() => []);
            for (const server of servers) {
                if (!ownsGuild(client, server.id)) continue;
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

        logger.info(`v${BOT_VERSION} Startup complete. Ready to serve in ${client.guilds.cache.size} servers.`);
        client.emit('readyForAction');

    }
}

export default main;