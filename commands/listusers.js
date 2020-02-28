link = require('./link.js');
config = require('./../config.json');
fs = require('fs');

// module.exports.help = {
//     name: "listusers",
//     description: "Lists all users and their API keys who are currently linked. **Nexus Mods Admin only**",
//     usage: "",
//     moderatorOnly: false,
//     adminOnly: true  
// }

exports.run = async (client, message, args) => {
    if (!config.ownerID.includes(message.author.id)) return //message.channel.send("You cannot use this action.")
    if (message.guild) return message.author.send("You can only do this via DM.")
 
    var linkedAccounts = link.linkedAccounts
    var fullMemberData = []

    linkedAccounts.forEach(function(element) {
        const discordID = linkedAccounts.findKey(user => user.nexusID === element.nexusID);
        discordID ? element.id = discordID : undefined;
        //console.log(element)
        //if (element.apikey) element.apikey = 'Valid'
        fullMemberData.push(element)
    })
    //console.log(fullMemberData)
    fs.writeFile("./NexusModsExport.json", JSON.stringify(fullMemberData, null, 2), (err) => {if (err) throw err})
    await message.reply(`${link.linkedAccounts.count} member accounts recorded.`,{files:[{attachment: 'NexusModsExport.json', name: 'NexusModsExport.json'   }]}).catch(console.error)
    fs.unlink("./NexusModsExport.json", (err) => {if (err) throw err})

};