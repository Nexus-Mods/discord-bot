const config = require("./../config.json");
const serverConfig = require("./../serverconfig.json");
const serverSetup = require("../commands/config.js");

module.exports = (client, message) => {
    if (message.guild && !serverConfig.find(s => s.id === message.guild.id)) serverSetup.createServerEntry(message.guild)

    if (message.author.bot) return; //ignore bots

    let prefix = false;
    for (const thisprefix of client.config.prefix) {
        if (message.content.startsWith(thisprefix)) prefix = thisprefix
    }
    if (!prefix) return; //No prefix
    
    //extract the content from message, trim off prefix
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase(); 

    const cmd = client.commands.get(command); //get the command from the commands list.
    if (!cmd) return //cancel if no command found

    cmd.run(client, message, args); //run the command.
};