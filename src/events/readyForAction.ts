import { Logger } from '../api/util';
import { DiscordEventInterface, ClientExt } from '../types/DiscordTypes';

import { NewsFeedManager } from '../feeds/NewsFeedManager';
import { AutoModManager } from '../feeds/AutoModManager';
import { SubscriptionManger } from '../feeds/SubscriptionManager';
import { migrationDeleteAPIkeyColumn } from '../api/users';

const main: DiscordEventInterface = {
    name: 'readyForAction',
    once: true,
    async execute(client: ClientExt, logger: Logger) {
        logger.info('Setting up feeds')
        // Start up the feeds
        try {
            client.newsFeed = await NewsFeedManager.getInstance(client, logger);
            client.automod = await AutoModManager.getInstance(client, logger);
            client.subscriptions = await SubscriptionManger.getInstance(client, logger);
        }
        catch(err) {
            logger.error('Error starting up feeds', err);
        }

        // Run migration of database if required
        try {
            const version = process.env.npm_package_version;
            // Delete the API key column from users
            if (version === '3.13.0') await migrationDeleteAPIkeyColumn(logger);
        }
        catch(err) {
            logger.error('Error running database migrations', err);
        }

    }
}

export default main;