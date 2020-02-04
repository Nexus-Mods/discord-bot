const Discord = require('discord.js');
const nexusAPI = require('../api/nexus-discord.js');
const { getUserByDiscordId, updateServer } = require('../api/bot-db.js');

module.exports.help = {
    name: "config",
    description: "Configure the settings for your server.",
    usage: "[setting] [newvalue]",
    moderatorOnly: false,
    adminOnly: true,
    officialOnly: false 
}

exports.run = async (client, message, args, serverData) => {    

    if (!message.guild || !serverData) return //ignore DMs

    if(!message.member.hasPermission("MANAGE_CHANNELS")) return message.channel.send("Server configuration is only available to admininstrators."); //Don't let non-admins mess with these settings.

    if (args.length !== 0) {
        // We've got a command to process.
        switch (args[0]) {
            case "logging":
                setChannel("logging", args.slice(1), serverData, message);
                break;
            case "nexuslog":
                setChannel("nexuslog", args.slice(1), serverData, message);
                break;
            case "botchannel":
                setChannel("botchannel", args.slice(1), serverData, message);
                break;
            case "newschannel":
                setChannel("news", args.slice(1), serverData, message);
                break;
            case "linkedrole":
                setRole("linkedrole", args.slice(1), serverData, message);
                break;
            case "premiumrole":
                setRole("premiumrole", args.slice(1), serverData, message);
                break;
            case "supporterrole":
                setRole("supporterrole", args.slice(1), serverData, message);
                break;
            case "authorrole":
                setRole("authorrole", args.slice(1), serverData, message);
                break;
            case "togglesearch":
                toggleSearch(args.slice(1), serverData, message);
            default: 
                return message.reply(`"${args[0]}" is an invalid command for config.`);       
        };
    }
    else { //no arguements so print the info we know.
        const serverInfoEmbed = await serverEmbed(serverData, client);
        return message.channel.send(serverInfoEmbed).catch(console.error);
    };
}

async function setChannel(type, args, serverData, message) {
    // Set a channel property on the server.
    let rowHeader;
    let newData = {};

    switch (type) {
        case "logging":
            rowHeader = "channel_log";
            break;
        case "nexuslog":
            rowHeader = "channel_nexus";
            break;
        case "bot":
            rowHeader = "channel_bot";
            break;
        case "news":
            rowHeader = "channel_news";
            break;
        default:
            return message.channel.send("Unknown channel type: "+type);
    };

    // Find the new channel, if there is one?
    const newChannel = (message.mentions.channels ? message.mentions.channels.first(): undefined) || (args.length ? message.guild.channels.find(c => c.name === args[0]) || message.guild.channels.find(c => c.id === args[0]) : undefined);

    newData[rowHeader] = newChannel ? newChannel.id : null;
    if (newData[rowHeader] === serverData[rowHeader]) return message.channel.send("No changes required.").catch(console.error);

    await updateServer(serverData.id, newData);
    console.log(`${new Date().toLocaleString()} - Updated channel "${type}" to ${newChannel.name || "None"} in ${message.guild}`);
    return message.channel.send(`Updated channel "${type}" to ${newChannel || "None"}`).catch(console.error);
}

async function setRole(type, args, serverData, message) {
    // Set a role property on a server.
    let rowHeader;
    let newData = {};
    
    switch (type) {
        case "linkedrole":
            rowHeader = "role_linked";
            break;
        case "supporterrole":
            rowHeader = "role_supporter";
            break;
        case "premiumrole":
            rowHeader = "role_premium";
            break;
        case "authorrole":
            rowHeader = "role_author";
            break;
        default:
            return message.channel.send("Unknown role type: "+type);
    };

    // Find the new role
    const newRole = await message.mentions.roles.first() ? message.mentions.roles.first() : message.guild.roles.find(c => c.id === args[1]) ? message.guild.roles.find(c => c.id === args[1]) : undefined;
    const newId = (!!newRole &&  !!newRole.id) ? newRole.id : null;
    newData[rowHeader] = newId;
    if (newData[rowHeader] === serverData[rowHeader]) return message.channel.send("No changes required.").catch(console.error);
    await updateServer(serverData.id, newData).catch(err => console.error);
    console.log(`${new Date().toLocaleString()} - Updated role "${type}" to ${newRole ? newRole.name : "None"} in ${message.guild}`);
    return message.channel.send(`Updated role "${type}" to ${newRole ? newRole.name : "None"}`).catch(console.error);
}

async function toggleSearch(args, serverData, message) {
    if (!args.length) {
        const newData = serverData.search_whid || serverData.search_whtoken ? {search_whid: null, search_whtoken: null} : undefined;
        if (newData) {
            await updateServer(serverData.id, newData);
            return message.channel.send("Disabled search in this server.").catch(console.error);
        }
        else {
            return message.channel.send("Search is not enabled in this server.").catch(console.error);
        };
    };

    try {
        if (!message.member.hasPermission("MANAGE_WEBHOOKS")) return message.reply("you do not have permission to create a webhook for the Search.").catch(err => console.log(err));;

        const searchChannel = message.mentions.channels.first() ? message.mentions.channels.first() : message.channel;
        const userData = await getUserByDiscordId(message.author.id);
        const gamesList = userData ? await nexusAPI.games(userData) : null;
        const searchFilter = gamesList.find(g => g.domain === args[0]).nexusmods_url;

        let newData = {};

        await searchChannel.createWebhook("Nexus Mods Quick Search", client.user.avatarURL)
        .then(webhook => webhook.edit("Nexus Mods Quick Search", client.user.avatarURL))
        .then(webhook => {
            newData.search_whid = webhook.id;
            newData.search_whtoken = webhook.token;
            if (searchFilter) newData.game_filter = searchFilter;
        });

        await updateServer(message.guild.id, newData);

        return message.channel.send(`Search initialised. Results will be posted in ${searchChannel}${searchFilter ? ` with a default game filter of ${searchFilter}.` : '.'}`).catch(err => console.log(err));

    }
    catch(err) {
        console.log("Error toggling search in "+message.guild, err);
        return message.channel.reply(`Error toggling search: ${err}`).catch(err => console.log(err));
    }
}

async function serverEmbed(serverData, client) {
    // Get the data required.
    const guild = client.guilds.find(g => g.id === serverData.id);
    const linkedRole = serverData.role_linked ? guild.roles.find(r => r === serverData.role_linked) : null;
    const premiumRole = serverData.role_premium ? guild.roles.find(r => r === serverData.role_premium) : null;
    const supporterRole = serverData.role_supporter ? guild.roles.find(r => r === serverData.role_supporter) : null;
    const authorRole = serverData.role_author ? guild.roles.find(r => r === serverData.role_author) : null;
    const newsChannel = serverData.channel_news ? guild.channels.find(c => c.id === serverData.channel_news) : null;
    const logChannel = serverData.channel_log ? guild.channels.find(c => c.id === serverData.channel_log) : null;
    const botChannel = serverData.channel_bot ? guild.channels.find(c => c.id === serverData.channel_bot) : null;
    const nexusChannel  = serverData.channel_nexus ? guild.channels.find(c => c.id === serverData.channel_nexus) : null;
    const searchChannelID = serverData.search_whid && serverData. search_whtoken 
    ? await guild.fetchWebhooks().then(wh => wh.find(w => w.id === serverData.search_whid).channelID)
    : null;
    const searchChannel = searchChannelID ? guild.channels.find(c => c.id === searchChannelID) : null;
    const guildOwner = guild.owner;

    // Build an embed for this server.
    const embed = new Discord.RichEmbed()
    .setTitle("Server Configuration")
    .setDescription("Configure any of these options for your server by typing the following command: \n`!NM config <setting> <newvalue>`")
    .setColor(0xda8e35)
    .setAuthor(guild.name, guild.iconURL)
    .addField("Connected Accounts Role", `${linkedRole ? linkedRole : '*Not set*'} \nSet using \`linkedrole <role>\``, true)
    .addField("Nexus Mods Author Role", `${authorRole ? authorRole : '*Not set*'} ${authorRole ? `\nAuthors with ${serverData.author_min_downloads || 1000}+ mod downloads.`: ""}\nSet using \`authorrole <role> <downloads>\``, true)
    .addBlankField()
    .addField("Nexus Mods Supporter Role", `${supporterRole ? supporterRole : '*Not set*'} \nSet using \`supporterrole <role>\``,true)
    .addField("Nexus Mods Premium Role", `${premiumRole ? premiumRole : '*Not set*'} \nSet using \`premiumrole <role>\``, true)
    .addField("Channels Settings", `**Bot:** ${botChannel ? `${botChannel} \nTo bot will only respond to commands here. Set using \`botchannel <channel>\`` : `_Not set._ \nTo bot will respond to commands in all channels. Set using \`botchannel <channel>\``}\n`)
    .addField("Nexus Mods Logging", nexusChannel ? `Enabled in ${nexusChannel} \nTurn off using \`nexuslog\`` : "Disabled \nTurn on using `nexuslog <channel>`",true)
    .addField("Search", `${searchChannel ? `Enabled in ${searchChannel}. Searching ${serverData.game_filter ? serverData.game_filter : "all"} mods. \nTurn off using \`togglesearch\`` : "Disabled. \nTurn on using `togglesearch` `<gamedomain> <channel>`"}`,true)
    .setFooter(`Server ID: ${guild.id} | Owner: ${guildOwner.user.tag}`);

    // These features are depreciated or only appear under specific conditions. 
    if (newsChannel) embed.addField("New Channel", `${newsChannel}\nThis feature is now depreciated. Follow the announcments channel at https://discord.gg/nexusmods`);
    if (logChannel) embed.addField("Activity Logging", `Enabled in ${logChannel}. Depreciated. \nTurn off using \`loggingoff\``,true);
    if (serverData.official) embed.addField("Official Nexus Mods Server", 'This server is an official Nexus Mods server, all bot functions are enabled.');

    return embed;

}

// exports.createServerEntry = (newGuild) => {
//     console.log(newGuild.name+" not found in JSON file. Creating a new entry.") 
//     var newData = {
//         "id": newGuild.id,
//         "name": newGuild.name,
//         "official": false,
//         //"logging": false,
//         //"linkedRole": "",
//         //"premiumRole": "",
//         //"supporterRole": "",
//         //"modAuthorRole": "",
//         //"modAuthorDownloadMinimum": 1000,
//         //"logChannel": "",
//         //"defaultChannel": "",
//         //"webhookID": "",
//         //"webhookToken":"",
//         //"searchGameFilter": undefined,
//         //"announcementChannel": ""
//     }
//     serverConfig.push(newData)
//     //updateJSON(serverConfig)
//     return newData
// }

/*
Server Data structure
{
   id: guildId,
   official: nexusModsOffical?,
   channel_bot: previously defaultChannel,
   channel_nexus: previously nexusLogChannel,
   channel_log: previously logChannel,
   channel_news: previeously announceChannel,
   role_author: previously modAuthorRole,
   role_premium: previously premiumRole,
   role_supporter: previously supporterRole,
   role_linked: previously linkedRole,
   author_min_downloads: previously modAuthorDownloadMinimum,
   game_filter: previously searchGameFilter,
   search_whid: previously webhookID,
   search_whtoken: previously webhookToken,
   server_owner: guild.ownerID NEW!
}
*/