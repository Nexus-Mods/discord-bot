module.exports.help = {
    name: "purgechannel",
    description: "Removes the specified ammount of messages from the current channel. Note: Messages over 14 days cannot be deleted. **Admin only**",
    usage: "[#number(0-100)]",
    moderatorOnly: true,
    adminOnly: false  
}

exports.run = (client, message, args) => {
    if (!message.guild) return console.log("Doesn't work in DMs dingus!")
    if (!message.member.hasPermission("BAN_MEMBERS")) return
    if (args === []) return message.channel.send("Please specify an ammount of messages to remove.")
    var count = parseInt(args[0]) <= 100 ? parseInt(args[0]) : 100;
    message.channel.bulkDelete(count).catch(console.error);
    message.channel.send(`Deleted ${count} messages.`)
};