const { addServer, getServer } = require('../api/bot-db.js');

module.exports = async (client, message) => {
    if (message.author.bot) return; //ignore bots

    //Check if a prefix has been used.
    let prefix = false;
    for (const thisprefix of client.config.prefix) {
        if (message.content.startsWith(thisprefix)) prefix = thisprefix;
    }
    if (!prefix) return; //No prefix

    
    //extract the content from message, trim off prefix
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase(); 

    const cmd = client.commands.get(command); //get the command from the commands list.
    if (!cmd) return //cancel if no command found

    //Setup server data
    let serverData
    if (message.guild) {
        serverData = await getServer(message.guild);
        if (!serverData) {
            try {
                await addServer(message.guild);
                serverData = await getServer(message.guild);
            }
            catch(err) {
                console.log(err);
            } 
        };
 
    }

    cmd.run(client, message, args, serverData); //run the command.
};