const Discord = require('discord.js');
const link = require("./../commands/link.js");
const serverConfig = require("../serverconfig.json");

module.exports = async (client, member) => {
  var serverSettings = serverConfig.find(s => s.id === member.guild.id);
  if (!serverSettings || !serverSettings.logChannel) return //We don't care about this member. 
  console.log(new Date()+" - "+member.user.tag+" joined "+member.guild);


  const moderationChannel = serverSettings.logChannel ? member.guild.channels.get(serverSettings.logChannel) : undefined
  if (!moderationChannel) return;

  var joinembed = new Discord.RichEmbed()
  .setColor(0xa4c21e)
  .setAuthor("Member Joined", member.user.avatarURL)
  .setDescription(`**${member} ${member.user.tag}**`)
  .setThumbnail(member.avatarURL)
  .setTimestamp(member.joinedAt)
  .setFooter(`ID:${member.user.id}`)
  
  var timeNow = new Date()
  var timeSinceRegister = Number(timeNow) - Number(member.user.createdAt)

  if (timeSinceRegister < (1000*60*60*24)) joinembed.addField("New Account",`Discord Account created ${timeDifference(timeSinceRegister,0)}`) //user has been on Discord less than a day

  //Do we know this user?
  if (link.linkedAccounts.has(member.user.id)) {
    await link.updateRoles(client, member.user).then(
      (success) => {
        joinembed.addField("Nexus Mods Account linked", `[${success.nexusName}](https://www.nexusmods.com/users/${success.nexusID})\n${success.nexusPremium ? "Premium Member" : success.nexusSupporter ? "Supporter" : "Member"}`)
      },
      (failure) => {return}
    )
  }
  

  moderationChannel.send(joinembed).catch(console.error)

}

function timeDifference(current, previous) {
  //console.log("timedifference for:"+current+" - "+previous)
  var msPerMinute = 60 * 1000;
  var msPerHour = msPerMinute * 60;
  var msPerDay = msPerHour * 24;
  var msPerMonth = msPerDay * 30;
  var msPerYear = msPerDay * 365;

  var elapsed = current - previous;

  if (elapsed < msPerMinute) {
       return Math.round(elapsed/1000) + ' seconds ago';   
  }

  else if (elapsed < msPerHour) {
       return Math.round(elapsed/msPerMinute) + ' minutes ago';   
  }

  else if (elapsed < msPerDay ) {
       return Math.round(elapsed/msPerHour ) + ' hours ago';   
  }

  else if (elapsed < msPerMonth) {
      return 'approximately ' + Math.round(elapsed/msPerDay) + ' days ago';   
  }

  else if (elapsed < msPerYear) {
      return 'approximately ' + Math.round(elapsed/msPerMonth) + ' months ago';   
  }

  else {
      return 'approximately ' + Math.round(elapsed/msPerYear ) + ' years ago';   
  }
}