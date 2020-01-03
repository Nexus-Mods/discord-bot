const { getUserByDiscordId, createUser, deleteUser, updateUser } = require('../api/bot-db.js');
const nexusAPI = require('../api/nexus-discord.js');
const Discord = require('discord.js');

// Some consts for the API listener:
const apiFilter = m => m.content.length > 50 && m.content.indexOf(" ") === -1 //Conditions of api key being sent on it's own. 
const apiCollectorDuration = 60000
const pleaseSendKeyEmbed = new Discord.RichEmbed()
.setTitle('Please send your API to key to link your Nexus Mods account')
.setColor(0xda8e35)
.setURL(`https://www.nexusmods.com/users/myaccount?tab=api+access`)
.setDescription(`Please send your API key in this channel within the next ${apiCollectorDuration/1000/60} minute(s) or use the command \`!nexus link apikeyhere\`.`
+`\nYou can get your API key by visiting your [Nexus Mods account settings](https://www.nexusmods.com/users/myaccount?tab=api+access).`)
.setImage(`https://staticdelivery.nexusmods.com/images/2295/31179975-1560441071.gif`);

module.exports.help = {
    name: "link",
    description: "Allows linking of your Nexus Mods account to your Discord account using [your API key](https://www.nexusmods.com/users/myaccount?tab=api%20access). \n*You must send your API key in a Direct Message, once linked you can use this to toggle your account link in each server.*",
    usage: "[API key]",
    moderatorOnly: false,
    adminOnly: false  
}

exports.run = async (client, message, args, serverData) => {
    //Get reply channel from server settings.
    const replyChannel = serverData && serverData.defaultChannel ? message.guild.channels.find(c => c.id === serverSettings.defaultChannel) : message.channel;
    const discordId = message.author.id;

    let accountData = await getUserByDiscordId(discordId);
    //console.log(accountData);

    if (accountData) {
        if (message.guild && accountData.servers.indexOf(message.guild.id) === -1) {
            accountData.servers.push(message.guild.id);
            const updateData = {servers: accountData.servers};
            updateUser(discordId, updateData);
            // TODO! - Send to reply channel if applicable. 
            return replyChannel.send((replyChannel !== message.channel ? message.author : message.author.tag)+" your account has been linked in this server. Type `!nexus whoami` to see your profile card.")
        }
        else {
            return replyChannel.send((replyChannel !== message.channel ? message.author : message.author.tag)+ ` your Discord account is already linked to the Nexus Mods user ${accountData.name}.`);
        }
    }

    let apiCollect
    // User has started the link from a public channel.
    if (message.channel.type !== 'dm') {
        // TODO! - Send to reply channel
        message.channel.send(`${message.author}, I've sent you a Direct Message about verifying your account. Your API key should never be posted publicly.`).catch(console.error);
        try {
            pleaseSendKeyEmbed.setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent} ${message.guild ? `${message.guild.name} - ${message.channel.name}`: ""}`,client.user.avatarURL)
            var helpMSG = await message.author.send(pleaseSendKeyEmbed).catch(console.error);
            // Start collecting messages.
            apiCollect = await helpMSG.channel.createMessageCollector(apiFilter, {maxMatches: 1, time: apiCollectorDuration});
            if (args.length > 0) message.delete().catch(console.error);

        }
        catch(err) {
            console.log(err);
            if (args.length > 0) message.delete().catch(console.error);
            // TODO! - Send to reply channel
            return replyChannel.send((replyChannel !== message.channel ? message.author : message.author.tag)+"I can't seem to send you DMs at the moment, you'll need to enable this to link your Nexus Mods account.");
        }
    }
    // User has posted in a DM.
    else {
        if (args.length === 0) {
            pleaseSendKeyEmbed.setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent} ${message.guild ? `${message.guild.name} - ${message.channel.name}`: ""}`,client.user.avatarURL);
            message.author.send(pleaseSendKeyEmbed);
            // Start collecting messages.
            apiCollect = await message.channel.createMessageCollector(apiFilter,{maxMatches: 1, time: apiCollectorDuration});

        }
        else {
            // Validate the API key.
            return checkAPIKey(client, message, args[0]);
        }
    }

    apiCollect.on('collect', async m => {
        //console.log("Message collected.")
        //Grab the api key we've been sent.
        var apiKeyToCheck = m.cleanContent;
        // Validate the API key.
        checkAPIKey(client, m, apiKeyToCheck);
    });

    apiCollect.on('end', collected => {
        if (!collected.size && !getUserByDiscordId(discordId)) message.author.send("You did not send an API key in time, please try again with `!nexus link`").catch(console.error);
    });
}

async function checkAPIKey(client, message, apiKeyToCheck) {
    try {
        const msg = await message.reply("Checking your API key...")
        const apiData = await nexusAPI.validate(apiKeyToCheck);
        const memberData = {
            d_id: message.author.id,
            id: apiData.user_id,
            name: apiData.name,
            avatar_url:apiData.profile_url,
            apikey: apiData.key,
            supporter: !apiData.is_premium && apiData.is_supporter ? true : false,
            premium: apiData.is_premium,
            servers: []
        }
        await createUser(memberData);
        const accountData = await getUserByDiscordId(message.author.id);


        // TODO! - Update roles


        console.log(new Date().toLocaleString()+` - ${accountData.name} linked to ${message.author.tag}`);
        msg.edit(`You have now linked the Nexus Mods account "${accountData.name}" to your Discord account in ${accountData.servers.length} Discord Servers.`).catch(console.error);
    }
    catch(err) {
        return msg.edit(`Could not link your account due to the following error:\n`+err);
    }
}