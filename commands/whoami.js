const whoIs = require('./whois.js');

module.exports.help = {
    name: "whoami",
    description: "Display your own profile card.",
    usage: "",
    moderatorOnly: false,
    adminOnly: false  
}

exports.run = async (client, message, args) => {
    newArgs = [message.author.tag]
    return whoIs.run(client, message, newArgs)
}