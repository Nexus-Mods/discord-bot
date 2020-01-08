const Discord = require(`discord.js`);
// const link = require('./../commands/link.js');
// const serverConfig = require("../serverconfig.json");
// const linkedAccounts = link.linkedAccounts

module.exports = (client, oldMember, newMember) => {
    return;
    // var serverSettings = serverConfig.find(s => s.id === newMember.guild.id);
    // if (!serverSettings || !serverSettings.logChannel) return //We don't care about this event. 

    // const moderationChannel = serverSettings.logChannel ? newMember.guild.channels.get(serverSettings.logChannel) : undefined
    // if (!moderationChannel) return console.error(`Could not locate moderation log channel at ${newMember.guild.name}`);
    
    
    // if (!oldMember.roles.equals(newMember.roles)) {
    //     console.log(`${newMember.user.tag} roles updated at ${newMember.guild} from ${oldMember.roles.map(role => role.name)} to ${newMember.roles.map(role => role.name)}`)
    //     var newRoles = compareroles(oldMember.roles, newMember.roles)
    //     var removedRoles = compareroles(newMember.roles, oldMember.roles)
    //     var roleChange = new Discord.RichEmbed()
    //     .setColor(0x57a5cc)
    //     .setAuthor("Roles Changed",newMember.user.avatarURL)
    //     .setTimestamp(new Date())
    //     .setDescription(`**${newMember} ${newMember.user.tag} roles updated**`)
    //     if (removedRoles.first()) roleChange.addField("Removed Roles", removedRoles.map(r => r.name).join("\n"), true)
    //     if (newRoles.first()) roleChange.addField("Added Roles", newRoles.map(r => r.name).join("\n"), true)
    //     .setFooter("ID:"+newMember.user.id)
    //     if (linkedAccounts.has(newMember.user.id)) roleChange.addField("Nexus Mods Account", `[${linkedAccounts.get(newMember.user.id).nexusName}](https://www.nexusmods.com/users/${linkedAccounts.get(newMember.user.id).nexusID})`,true)
    //     return moderationChannel.send(roleChange).catch(console.error)
    //     }
    // //console.log(oldMember.nickname+" "+newMember.nickname)
    // if (oldMember.nickname !== newMember.nickname) {
    //     var nameChange = new Discord.RichEmbed()
    //     .setColor(0x57a5cc)
    //     .setAuthor("Nickname Changed",newMember.user.avatarURL)
    //     .setTimestamp(new Date())
    //     .setDescription(`**${newMember} ${newMember.user.tag} nickname updated**`)
    //     .addField("Old Nickname",(oldMember.nickname ? oldMember.nickname : oldMember.user.username),true)
    //     .addField("New Nickname",(newMember.nickname ? newMember.nickname : newMember.user.username), true)
    //     .setFooter("ID:"+newMember.user.id)
    //     if (linkedAccounts.has(newMember.user.id)) nameChange.addField("Nexus Mods Account", `[${linkedAccounts.get(newMember.user.id).nexusName}](https://www.nexusmods.com/users/${linkedAccounts.get(newMember.user.id).nexusID})`,true)
    //     return moderationChannel.send(nameChange).catch(console.error)
    // }
};

function compareroles(oldRoles, newRoles) {
    return newRoles.filter(r => !oldRoles.find(or => or === r))
}