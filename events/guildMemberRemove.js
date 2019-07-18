const Discord = require('discord.js');
const link = require("./../commands/link.js");
const serverConfig = require("../serverconfig.json");

module.exports = async (client, member) => {
  var serverSettings = serverConfig.find(s => s.id === member.guild.id);
  if (!serverSettings || !serverSettings.logChannel) return //We don't care about this member.
  console.log(new Date()+" - "+member.user.tag+" "+(await member.guild.fetchBans().then(bans => bans.get(member.user.id)) ? "banned from" : "left")+" "+serverSettings.name); 

  var moderationChannel = serverSettings.logChannel ? member.guild.channels.get(serverSettings.logChannel) : undefined
  if (!moderationChannel) return;

  var postTitle = await (member.guild.fetchBans().then(bans => bans.get(member.user.id) ? "Member Banned" : "Member Left")) //? "Member Banned" : "Member Left"


  var leaveembed = new Discord.RichEmbed()
  .setColor(0x976060)
  .setAuthor(postTitle, member.user.avatarURL)
  .setDescription(`**${member} ${member.user.tag}**`)
  .setThumbnail(member.avatarURL)
  .setTimestamp(new Date())
  .setFooter(`ID:${member.user.id}`)

  //Do we know this user?
  if (link.linkedAccounts.has(member.user.id)) {
    var userData = link.linkedAccounts.get(member.user.id)
    leaveembed.addField("Nexus Mods Account unlinked",userData.nexusName)
    userData.serversLinked.splice(userData.serversLinked.find(s => s.id === member.guild.id),1)
    link.linkedAccounts.set(`${member.user.id}`, userData)
  }

  moderationChannel.send(leaveembed)
  
};