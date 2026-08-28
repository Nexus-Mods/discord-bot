import { Logger } from '../api/util';
import { DiscordEventInterface, ClientExt } from '../types/DiscordTypes';

import { NewsFeedManager } from '../feeds/NewsFeedManager';
import { SubscriptionManger } from '../feeds/SubscriptionManager';

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