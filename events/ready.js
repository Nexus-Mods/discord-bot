const serverConfig = require("../serverconfig.json");
const config = require("../config.json");
const Discord = require('discord.js');
const fs = require('fs');
const onlineEmbed = new Discord.RichEmbed()
.setTitle('Nexus Mods Discord Bot is online.')
.setColor(0x009933)

let firstStartUp = false

module.exports = async (client) => {
    console.log(`${new Date()} - Ready to serve in ${client.channels.size} channels on ${client.guilds.size} servers, for a total of ${client.users.size} users.`);
    client.user.setActivity(`the channels for ${client.config.prefix[0]}`, {type: 'Watching'});
    
    if (config.testing) return console.log('Testing mode - did not publish online message.');
    if (firstStartUp) return

    firstStartUp = true

    for (i=0; i < serverConfig.length; i++) {
      var curServer = serverConfig[i];
      if (curServer.id && !client.guilds.find(s => s.id === curServer.id)) {
        console.log(`${new Date()} - Deleting non-existant server: ${curServer.name}`)
        serverConfig.splice(i,1)
        i--
        updateJSON(serverConfig)
      }
      if (curServer.nexusLogChannel) {
        var botChannel = client.channels.find(c => c.id === curServer.nexusLogChannel);
        onlineEmbed.setTimestamp(new Date());
        if (botChannel) botChannel.send(onlineEmbed).catch(console.error);
      };
    };
  };

  function updateJSON(newJSON) {
    fs.writeFile("serverconfig.json", JSON.stringify(newJSON, null, 2), function(err){
        if (err) throw err;
        //console.log('The "data to append" was appended to file!')
    });
}