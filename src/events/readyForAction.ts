import { Logger } from '../api/util.js';
import { DiscordEventInterface, ClientExt } from '../types/DiscordTypes.js';

import { NewsFeedManager } from '../feeds/NewsFeedManager.js';
import { SubscriptionManger } from '../feeds/SubscriptionManager.js';

const main: DiscordEventInterface = {
    name: 'readyForAction',
    once: true,
    async execute(client: ClientExt, logger: Logger) {
        logger.info('Setting up feeds')
        // Start up the feeds
        try {
            client.newsFeed = await NewsFeedManager.getInstance(client, logger);
            client.subscriptions = await SubscriptionManger.getInstance(client, logger);
        }
        catch(err) {
            logger.error('Error starting up feeds', err);
        }
    }
}

export default main;