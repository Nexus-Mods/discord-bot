const { deleteServer, getAllServers } = require('../api/bot-db.js');
const Discord = require('discord.js');
const onlineEmbed = new Discord.RichEmbed()
.setTitle('Nexus Mods Discord Bot is online.')
.setColor(0x009933);
const newsFeed = require('../feeds/nexus-news.js');
const gameFeed = require('../feeds/game-feeds.js');
const modFeed = require('../feeds/mod-feeds.js');

let firstStartUp = false

module.exports = async (client) => {
  console.log(`${new Date().toLocaleString()} - Ready to serve in ${client.channels.size} channels on ${client.guilds.size} servers, for a total of ${client.users.size} users.`);
  client.user.setActivity(`the channels for ${client.config.prefix[0]}`, {type: 'Watching', url: "https://discord.gg/nexusmods"});
  if (client.user.username !== "Nexus Mods") client.user.setUsername("Nexus Mods");

  if (firstStartUp) return
  firstStartUp = true;

  // Start the news and feeds TODO!
  newsFeed.run(client).catch((err) => console.warn('Setting up news feed failed', err.message));
  gameFeed.run(client).catch((err) => console.warn('Setting up game feeds failed', err.message));
  modFeed.run(client).catch((err) => console.warn('Setting up mod feeds failed', err.message));

  if (client.config.testing) return console.log('Testing mode - did not publish online message.');
  const allServers = await getAllServers();

  // Post the online notice.
  for(const server of allServers) {
    const discordGuild = await client.guilds.find(s => s.id === server.id);
    if (!discordGuild) {
      await deleteServer(server.id);
      return console.log(`${new Date().toLocaleString()} - Deleting non-existant server: ${server.id}`);
    };
    if (server.channel_news) {
      const logChannel = discordGuild.channels.find(c => c.id === server.channel_nexus);
      if (!logChannel) return console.log(`${new Date().toLocaleString()} - Log channel no longer exists for: ${discordGuild.name}`)
      onlineEmbed.setTimestamp(new Date());
      logChannel.send(onlineEmbed).catch((err) => console.error(`${new Date().toLocaleString()} - Error posting online notice to log channel in ${discordGuild.name}\n${err}`));
    };
  };
}