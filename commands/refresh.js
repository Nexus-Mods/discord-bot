const Discord = require('discord.js');
const { getUserByDiscordId, userEmbed, updateUser, getModsbyUser, updateMod, updateAllRoles } = require('../api/bot-db.js');
const nexusAPI = require('../api/nexus-discord.js');
const Bluebird = require('bluebird');

module.exports.help = {
    name: "refresh",
    description: "Refresh your profile card and mod downloads.",
    usage: "",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}


exports.run = async (client, message, args, serverData) => {
    //Get reply channel from server settings.
    const replyChannel = serverData && serverData.channel_bot ? message.guild.channels.find(c => c.id === serverData.channel_bot) : message.channel;
    const discordId = message.author.id;
    const userData = await getUserByDiscordId(discordId);
    if (!userData) return replyChannel.send("There are no accounts linked to the Discord account "+message.author.tag);
    let resultEmbed = new Discord.RichEmbed()
    .setTitle('Updating user data...')
    .setColor(0xda8e35)
    .setThumbnail(userData.avatar_url)
    .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user.avatarURL);

    let replyMsg = await replyChannel.send(resultEmbed);
    // Prevent updating multiple times in a short period.
    if (userData.lastupdate.getTime() + (1*60*1000) > new Date().getTime()) {
        resultEmbed.setTitle('Update Cancelled')
        .setDescription('You must wait at least 1 minute before refreshing your account again.');
        return replyMsg.edit('', {embed: resultEmbed}, 'Rejected - Too Soon!');
    }


    // Update user info based on API key
    try {
        const apiData = await nexusAPI.validate(userData.apikey);
        let newUserInfo = {};
        if (userData.id !== apiData.user_id) newUserInfo.id = apiData.user_id;
        if (userData.name !== apiData.name) newUserInfo.name = apiData.name;
        if (userData.avatar_url !== apiData.profile_url) newUserInfo.avatar_url = apiData.profile_url;
        if ((!apiData.is_premium && apiData.is_supporter) !== userData.supporter) newUserInfo.supporter = !userData.supporter;
        if (userData.premium !== apiData.is_premium) newUserInfo.premium = true;

        if (Object.keys(newUserInfo).length) {
            const keys = Object.keys(newUserInfo);
            try {
                resultEmbed.addField('User Data', `Updated ${keys.length} value(s): ${keys.join(', ')}`);
                await updateUser(discordId, newUserInfo);
                await updateAllRoles(userData, client, false);
            }
            catch(err) {
                resultEmbed.addField('User Data', `Error updating user data: ${err}`);
            }
        }
        else resultEmbed.addField('User Data', 'No changes required.');
    }
    catch(err) {
        resultEmbed.addField('User Data', `An error occured ${err}`);
    }

    await replyMsg.edit('', {embed: resultEmbed}, 'Updated user data');
    

    // Update mod downloads
    const userMods = await getModsbyUser(userData.id);
    const modsToUpdate = await Bluebird.map(userMods, async (mod) => {
        const modInfo = await nexusAPI.modInfo(userData, mod.domain, mod.mod_id);
        const dlInfo = await nexusAPI.getDownloads(userData, mod.domain, -1, mod.mod_id);
        let newInfo = {};
        if (modInfo.name && mod.name !== modInfo.name) newInfo.name = modInfo.name;
        if (dlInfo.unique_downloads > mod.unique_downloads) newInfo.unique_downloads = dlInfo.unique_downloads;
        if (dlInfo.total_downloads > mod.total_downloads) newInfo.total_downloads = dlInfo.total_downloads;
        await updateMod(mod, newInfo);
        return Object.keys(newInfo).length ? mod : undefined;
    }).filter(m => m !== undefined);

    if (modsToUpdate.length) {
        resultEmbed.addField('Mods', `Updated mod info for: ${modsToUpdate.map(m => m.name).join(', ')}`);
    }
    else resultEmbed.addField('Mods', 'No changes required.');

    resultEmbed.setTitle('Update Complete');

    await replyMsg.edit('', {embed: resultEmbed}, 'Updated user mods');

    // Reply with the results.
}