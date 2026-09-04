import type { Logger } from "../api/logger.js";
import type { DiscordEventInterface, ClientExt } from '../types/DiscordTypes.js';

import { NewsFeedManager } from '../feeds/NewsFeedManager.js';
import { SubscriptionManger } from '../feeds/SubscriptionManager.js';

const main: DiscordEventInterface = {
    name: 'readyForAction',
    once: true,
    async execute(client: ClientExt, logger: Logger) {
        logger.info('Setting up feeds')
        // Start up the feeds
        try {
            // eslint-disable-next-line require-atomic-updates
            client.newsFeed = await NewsFeedManager.getInstance(client, logger);
            // eslint-disable-next-line require-atomic-updates
            client.subscriptions = await SubscriptionManger.getInstance(client, logger);
        }
        catch(err) {
            logger.error('Error starting up feeds', err);
        }
    }
}

export default main;