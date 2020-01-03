const { getAllUsers } = require('../api/bot-db.js');
//const fs = require('fs');

// module.exports.help = {
//     name: "listusers",
//     description: "Lists all users and their API keys who are currently linked. **Nexus Mods Admin only**",
//     usage: "",
//     moderatorOnly: false,
//     adminOnly: true  
// }

exports.run = async (client, message, args) => {
    if (!client.config.ownerID.includes(message.author.id)) return //message.channel.send("You cannot use this action.")
    if (message.guild) return message.author.send("You can only do this via DM.");
 
    const allUsers = getAllUsers();
    const allNames = allUsers.map(user => user.name).join(", ");
    message.reply(`${allUsers.length} users linked.\n\`\`\`${allNames.length > 3000 ? allNames.substring(0, 2900) + "\nAnd more..." : allNames}\`\`\``);


    //console.log(fullMemberData)
    // fs.writeFile("./NexusModsExport.json", JSON.stringify(fullMemberData, null, 2), (err) => {if (err) throw err})
    // await message.reply(`${link.linkedAccounts.count} member accounts recorded.`,{files:[{attachment: 'NexusModsExport.json', name: 'NexusModsExport.json'   }]}).catch(console.error)
    // fs.unlink("./NexusModsExport.json", (err) => {if (err) throw err})

};