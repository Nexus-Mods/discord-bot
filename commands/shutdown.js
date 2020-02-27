const serverConfig = require("../serverconfig.json");
const Discord = require('discord.js');
const { getAllServers } = require('../api/servers.js');
const offlineEmbed = new Discord.RichEmbed()
.setTitle('Nexus Mods Discord Bot is now offline.')

exports.run = async (client,message,args,serverData) => {
    if (!message.guild && client.config.ownerID.find(m => m === message.author.id)) {
      var shutdownMsg = await message.reply('Are you sure you want to shut down the Discord bot? It must be restarted from the console.\nReact with ✅ to confirm shut down.');
      var reactionFilter = (reaction, user) => (reaction.emoji.name === '✅' || reaction.emoji.name === '❌') && user.id === message.author.id;
      var collector = shutdownMsg.createReactionCollector(reactionFilter, {time: 15000, max: 1});
      shutdownMsg.react('✅');
      shutdownMsg.react('❌');
      collector.on('collect', async r => {
        //Shutdown confirmed.
        if (r.emoji.name === '❌') return message.reply('Shutdown aborted');
        await message.reply('Shutdown confirmed.');
        console.log("Shutdown confirmed by "+message.author.tag);
        await sendShutdownMessages(client);
        client.destroy();
        process.exit();
      });
      collector.on('end', rc => {
          //End
          if (rc.size === 0) return message.reply('Shutdown aborted');
      });

    }
};

async function sendShutdownMessages(client) {
  offlineEmbed.setTimestamp(new Date());

  const allServers = await getAllServers();
  for (server of allServers) {
    if (server.channel_nexus) return; // no log channel.
    const server = client.guilds.find(s => s.id === server.id);
    const channel = server ? server.channels.find(c => c.id === server.channel_nexus) : undefined;
    if (!server || !channel) return; // guild or channel not found.
    channel.send(offlineEmbed).catch(err => undefined);
  };
}