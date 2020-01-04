const { getUserByNexusModsName } = require('../api/bot-db.js');

exports.run = async (client, message, args) => {
    if (args.length === 0) return message.channel.send("Failed No arguments.");
    try {
        const nxmuser = await getUserByNexusModsName(args[0]);
        if (!nxmuser) return message.channel.send("No users found for "+args[0]);
        message.channel.send("Found: "+nxmuser.nexusname+"\n ```json\n"+JSON.stringify(nxmuser, null, 2)+"```");
    }
    catch(err) {
        console.log(err);
    }
}