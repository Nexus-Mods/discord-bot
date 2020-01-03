const serverConfig = require("../serverconfig.json");
const Discord = require('discord.js');
const offlineEmbed = new Discord.RichEmbed()
.setTitle('Nexus Mods Discord Bot is now offline.')

exports.run = async (client,message,args,serverData) => {
    if (!message.guild && client.config.ownerID.find(m => m === message.author.id)) {
      var shutdownMsg = await message.reply('Are you sure you want to shut down the Discord bot? It must be restarted from the console.\nReact with ✅ to confirm shut down.');
      var reactionFilter = (reaction, user) => (reaction.emoji.name === '✅' || reaction.emoji.name === '❌') && user.id === message.author.id
      var collector = shutdownMsg.createReactionCollector(reactionFilter, {time: 15000, max: 1})
      shutdownMsg.react('✅');
      shutdownMsg.react('❌');
      collector.on('collect', async r => {
        //BLEH
        if (r.emoji.name === '❌') return message.reply('Shutdown aborted')
        //await sendShutdownMessages()
        await message.reply('Shutdown confirmed.')
        console.log("Shutdown confirmed by "+message.author.tag)
        client.destroy()
        process.exit()
      });
      collector.on('end', rc => {
          //End
          if (rc.size === 0) return message.reply('Shutdown aborted')
      });

    }
};

function sendShutdownMessages() {
    // TODO! Update this function
    //Inform any servers with logging the bot is shutting down.
    for (i=0; i < serverConfig.length; i++) {
        var curServer = serverConfig[i];
        if (curServer.nexusLogChannel) {
          var botChannel = client.channels.find(c => c.id === curServer.nexusLogChannel);
          offlineEmbed.setTimestamp(new Date());
          if (botChannel) botChannel.send(offlineEmbed).catch(console.error);
        };
    };
}