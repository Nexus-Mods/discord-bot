const newsFeed = require('../feeds/nexus-news.js');

exports.run = async (client, message, args, serverData) => {
    // Ignore non-owners.
    if (!client.config.ownerID.find(m => m === message.author.id)) return;
    
    message.reply('Refreshing news feed.');
    return newsFeed.run(client).catch(() => undefined);
};