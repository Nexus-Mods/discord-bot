const Enmap = require("enmap");
const serverConfig = require('./../serverconfig.json') //For server specific settings.
const unlink = require("./unlink.js");
const Discord = require("discord.js");
const nexusAPI = require('./../nexus-discord.js');
const apiFilter = m => m.content.length > 50 && m.content.indexOf(" ") === -1 //Conditions of api key being sent on it's own. 
const apiCollectorDuration = 60000
const pleaseSendKeyEmbed = new Discord.RichEmbed()
.setTitle('Please send your API to key to link your Nexus Mods account')
.setColor(0xda8e35)
.setURL(`https://www.nexusmods.com/users/myaccount?tab=api+access`)
.setDescription(`Please send your API key in this channel within the next ${apiCollectorDuration/1000/60} minute(s) or use the command \`!nexus link apikeyhere\`.`
+`\nYou can get your API key by visiting your [Nexus Mods account settings](https://www.nexusmods.com/users/myaccount?tab=api+access).`)
.setImage(`https://staticdelivery.nexusmods.com/images/2295/31179975-1560441071.gif`)

module.exports.linkedAccounts = new Enmap({
    name: "NexusModsDiscordUsers",
    autoFetch: true,
    fetchAll: true
  });

exports.linkedAccounts.defer.then( () => 
  //exports.linkedAccounts.deleteall()
  console.log(`Database loaded with ${exports.linkedAccounts.count} members.`)
);

module.exports.help = {
    name: "link",
    description: "Allows linking of your Nexus Mods account to your Discord account using [your API key](https://www.nexusmods.com/users/myaccount?tab=api%20access). \n*You must send your API key in a Direct Message, once linked you can use this to toggle your account link in each server.*",
    usage: "[API key]",
    moderatorOnly: false,
    adminOnly: false  
}

exports.run = async (client, message, args) => {
    //Where should I reply?
    const serverSettings = message.guild && serverConfig.find(s => s.id === message.guild.id);
    var replyChannel = serverSettings && serverSettings.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel

    //if the entry exists
    if (exports.linkedAccounts.has(message.author.id)) {
        var nexusAccount = exports.linkedAccounts.get(message.author.id)
        if (message.guild && nexusAccount.serversLinked.indexOf(message.guild.id) === -1) {
            await exports.updateRoles(client, message.author)
            return replyChannel.send((replyChannel !== message.channel ? message.author : message.author.tag)+" your account has been linked. Type `!nexus whoami` to see your profile card.")
        }
        else {
            return replyChannel.send((replyChannel !== message.channel ? message.author : message.author.tag)+`". Your Discord account is already linked to Nexus Mods account "${nexusAccount.nexusName}". Updating your roles at ${nexusAccount.serversLinked.length} servers.`)
        }
        
    }

    var apiCollect
    //Posted in a public channel.
    if (message.channel.type !== 'dm') {
        replyChannel.send((replyChannel !== message.channel ? message.author : message.author.tag)+`, I've sent you a Direct Message about verifying your account. Your API key should never be posted publicly.`).catch(console.error)
        try {
            pleaseSendKeyEmbed.setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent} ${message.guild ? `${message.guild.name} - ${message.channel.name}`: ""}`,client.user.avatarURL)
            var helpMSG = await message.author.send(pleaseSendKeyEmbed).catch(console.error)
            //console.log('Message collector opening')
            apiCollect = await helpMSG.channel.createMessageCollector(apiFilter,{maxMatches: 1, time: apiCollectorDuration}) //Wait 2 mins for API key
            if (args.length > 0) message.delete()
        } 
        catch(err) {
            console.log(err)
            if (args.length > 0) message.delete()
            return replyChannel.send((replyChannel !== message.channel ? message.author : message.author.tag)+"I can't seem to send you DMs at the moment, you'll need to enable this to link your Nexus Mods account.");
        }        
    }
    //Posted in a direct message
    else {
        if (args.length === 0){
            pleaseSendKeyEmbed.setFooter(`Nexus Mods API link - ${message.guild ? message.channel.name: ""}${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL)
            message.author.send(pleaseSendKeyEmbed)
            //console.log('Message collector opening')
            apiCollect = await message.channel.createMessageCollector(apiFilter,{maxMatches: 1, time: apiCollectorDuration}) //Wait 2 mins for API key
        }
        else {
            //apiKeyToCheck = args[0]
            return checkAPIkey(client, message, args[0])
        }
    }

    apiCollect.on('collect', async m => {
        //Ladies and gentlemen, we got him. 
        var apiKeyToCheck = m.cleanContent
        //console.log('Message collector recieved: '+apiKeyToCheck)
        checkAPIkey(client, m, apiKeyToCheck)
        
    })
    
    apiCollect.on('end', collected => {
        //It's all over. 
        //console.log('Message collector closed')
        if (collected.size === 0 && !exports.linkedAccounts.has(message.author.id)) message.author.send("You did not send an API key in time, please try again with `!nexus link`").catch(console.error);
    })
}

async function checkAPIkey(client, message, apiKeyToCheck) {
    try {
        var APIData = await nexusAPI.validate(apiKeyToCheck)
        var memberData = {
            nexusID: APIData.user_id,
            nexusName: APIData.name,
            avatarURL: APIData.profile_url,
            apikey: APIData.key,
            nexusSupporter: !APIData.is_premium && APIData.is_supporter ? APIData.is_supporter : false,
            nexusPremium: APIData.is_premium,
            nexusModAuthor: false,
            nexusModDownloadTotal: 0,
            serversLinked: [],
            mods: [],
            lastupdate: new Date(Date.now())
        }
        await exports.linkedAccounts.set(message.author.id, memberData);
        await exports.updateRoles(client, message.author)
        var savedData = exports.linkedAccounts.get(message.author.id)
        console.log(new Date()+` - ${savedData.nexusName} linked to ${message.author.tag}`)
        message.reply(`You have now linked the Nexus Mods account "${savedData.nexusName}" to your Discord account in ${savedData.serversLinked.length} Discord Servers.`).catch(console.error)

    }
    catch(err) {
        return message.channel.send(`Could not link your account due to the following error:\n`+err)
    }
}

//Update server roles
exports.updateRoles = async (client, discordUser) => {
    return new Promise((resolve, reject) => {
        memberData = exports.linkedAccounts.get(discordUser.id)
        if (!memberData) return reject("Not found.")

        var iServers = serverConfig.length
        for(i = 0; i < iServers; i++){
            var guildData = serverConfig[i] //Stored data about this guild
            //console.log("Checking "+guildData.name)
            var guildToCheck = client.guilds.find(s => s.id === guildData.id)
            //console.log("Guild: "+guildToCheck.name)
            if (guildToCheck && guildToCheck.members.get(discordUser.id)) {
                memberData.lastupdate = new Date()
                
                //If we're allowed to, add roles to the user.
                if (guildToCheck.me.hasPermission("MANAGE_ROLES")) {
                    var discordGuildMember = guildToCheck.members.get(discordUser.id)//.find(usr => usr.id = discordUser.id)
                    var linked = guildData.linkedRole ? guildToCheck.roles.get(guildData.linkedRole) : null
                    var premium = guildData.premiumRole ? guildToCheck.roles.get(guildData.premiumRole) : null
                    var supporter = guildData.supporterRole ? guildToCheck.roles.get(guildData.supporterRole) : null
                    var author = guildData.modAuthorRole ? guildToCheck.roles.get(guildData.modAuthorRole) : null
                    //console.log(`${discordGuildMember.user.tag}\nLinked: ${linked}\nPremium: ${premium}\nSupporter: ${supporter}`)
                    //console.log(discordGuildMember.roles)
                    
                    var rolesToAdd = []
                    //console.log(discordGuildMember.roles.array())
                    if (linked && !discordGuildMember.roles.has(linked.id)) rolesToAdd.push(linked.id) //Add linked flag.
                    if (premium && memberData.nexusPremium && !discordGuildMember.roles.has(premium.id)) rolesToAdd.push(premium.id) //Check Premium
                    else if (supporter && !memberData.nexusPremium && memberData.nexusSupporter && !discordGuildMember.roles.has(supporter.id)) rolesToAdd.push(supporter.id) //Not Premium so check supporter. roles.find(r => r.id === supporter.id)
                    //If you're a mod author.
                    if (author && memberData.nexusModDownloadTotal >= guildData.modAuthorDownloadMinimum && !discordGuildMember.roles.has(author.id)) {
                        rolesToAdd.push(author.id);
                        discordUser.send(`You are now a recognised Mod Author on the Discord Server "${guildToCheck}"`).catch(console.error);
                    }

                    //if (rolesToAdd.length > 0) console.log(`Adding roles: ${rolesToAdd.toString()} to ${discordUser.tag} in ${guildToCheck.name}`)
                    if (rolesToAdd.length > 0) discordGuildMember.addRoles(rolesToAdd,"API authorisation").catch(console.error)//(`Some roles could not be added to ${discordUser.tag} in ${guildToCheck.name}`))
                }
                else console.log("Not allowed to manage roles in "+guildToCheck.name)
            
                //Log the link event.
                var linkedEmbed = new Discord.RichEmbed()
                .setAuthor(`${discordUser.tag} linked to Nexus Mods account "${memberData.nexusName}"`,discordUser.avatarURL)
                .setColor(0xda8e35)
                .setDescription("For more information, type `!nexus help link`.")
                .setTimestamp(new Date())
                .setFooter("🔗 Nexus Mods API link", client.user.avatarURL)

                //Check we know about this membership
                if (memberData.serversLinked.indexOf(guildToCheck.id) === -1) {
                    memberData.serversLinked.push(guildToCheck.id)
                    //console.log(`Added missing server ${guildData.name} to ${discordUser.tag}`)
                    exports.linkedAccounts.set(discordUser.id, memberData)
                    //moved inside here to only log servers that weren't included.
                    if (guildData.nexusLogChannel) {
                        var logChannel = guildToCheck.channels.get(guildData.nexusLogChannel)
                        logChannel.send(linkedEmbed).catch(console.error)
                    }
                }

                //return resolve(memberData)
            }
        }
        return resolve(memberData)
    }).catch(console.error)

    
}


//DAILY CHECK OF DATABASE
const delay = 1000*60*60*3; //3 hourly.
const dailyCheck = setInterval(checkMembers, delay);
console.log(new Date() + " - Set 3 hour delay on API key validation.")

async function checkMembers() {
    console.log(`${new Date()} - Performing check of API keys for ${exports.linkedAccounts.count} members.`)
    const linkedAccounts = exports.linkedAccounts
    linkedAccounts.forEach(async function(nexusLink) {
        var username = nexusLink.nexusName;
        var discordUser = client.users.get(linkedAccounts.findKey(e => e === nexusLink)) ? client.users.get(linkedAccounts.findKey(e => e === nexusLink)) : undefined;
        //console.log(`${username} : ${discordUser ? discordUser.tag : linkedAccounts.findKey(e => e === nexusLink)}`);
        var keyToCheck = nexusLink.apikey;
        await nexusAPI.validate(keyToCheck).then((response) => {
            console.log(`API key for ${username} (${discordUser ? discordUser.tag : "<ERROR>"}) is still valid.`)
            return Promise.resolve();
        }).catch(err => {
            if (err.message.indexOf("401") !== -1) {
                console.log(`WARN: API key no longer valid for ${username} (${discordUser.tag}) removing links in ${nexusLink.serversLinked.length} guilds.`);
                var serversToRemove = nexusLink.serversLinked.length
                for (i = 0; i < serversToRemove; i++) {
                    var serverToManage = client.guilds.get(nexusLink.serversLinked[i])
                    console.log(`Sending unlink for ${discordUser.tag}, ${nexusLink.nexusName} in ${serverToManage ? serverToManage : nexusLink.serversLinked[i]}`)
                    if (discordUser && nexusLink && serverToManage) unlink.unlink(discordUser, nexusLink, serverToManage)
                }
                discordUser.send(`Your API key for the Nexus Mods account ${username} is no longer valid. Your account link has been removed in ${nexusLink.serversLinked.length} server(s), please update your key by using \`!NM link\` again.`).catch(console.error)
                exports.linkedAccounts.delete(discordUser.id);
                return Promise.resolve();
            }
        });
    });


}