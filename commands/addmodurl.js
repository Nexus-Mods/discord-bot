const { getUserByDiscordId, getModsbyUser, createMod } = require('../api/bot-db.js');
const Discord = require('discord.js');
const nexusAPI = require('../api/nexus-discord.js');
const modUrlRegex = /nexusmods.com\/([a-zA-Z0-9]+)\/mods\/([0-9]+)/i

module.exports.help = {
    name: "addmodurl",
    description: "Allows authors to add mods to their profile cards in Discord.\nPaste mod page URLs separated by a comma.",
    usage: "[mod URLs]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

exports.run = async (client, message, args, serverData) => {
    // This could eventually be added into addmod.js
    const replyChannel = serverData && serverData.channel_bot ? message.guild.channels.find(c => c.id === serverData.channel_bot) : message.channel;
    const discordId = message.author.id;

    let userData = await getUserByDiscordId(discordId);

    if (!userData) return replyChannel.send(`${replyChannel === message.channel ? message.author.tag : message.author} please link your Nexus Mods account to use this feature. See \`!nexus link\` for more information.`).catch(console.error);

    if (args.length === 0) return replyChannel.send(`${replyChannel === message.channel ? message.author.tag : message.author}, to link a mod to your Discord account type \`!nexus addmodurl <mod link>\`.`).catch(console.error);

    const fullArgs = args.join(" ");
    const urls = await fullArgs.split(",").map(
        (link) => {
            const matches = link.trim().match(modUrlRegex);
            if (matches) return {domain: matches[1], id: matches[2], url: `https://www.nexusmods.com/${matches[1]}/mods/${matches[2]}`};
        }
    ).filter(l => l);
    //console.log(urls);
    
    if (!urls.length) return replyChannel.send(`${replyChannel === message.channel ? message.author.tag : message.author}, your message contained no valid mod page links.`).catch(console.error);
    
    const searchingEmbed = new Discord.RichEmbed().setTitle('Getting data from Nexus Mods...').setDescription(urls.map(url => url.url).join("\n")).setFooter(`Nexus Mods API link - ${message.author.tag}`,client.user.avatarURL).setColor(0xda8e35);
    let workingMessage = await replyChannel.send(searchingEmbed).catch(console.error);
    console.log(`${new Date().toLocaleString()} - Getting data for ${urls.length} mods requested by ${userData.name} in ${message.guild || 'a DM'}.`);
    
    let userMods = await getModsbyUser(userData.id);
    let messages = []; //Messages to show
    // Look up mods from the provided URLs
    try {
        const gameData = await nexusAPI.games(userData, false);
        let newMods = [];
        for (const url of urls) {
            if (userMods.find( (mod) => mod.domain === url.domain && mod.id === url.id)) {
                const existing = userMods.find( (mod) => mod.domain === url.domain && mod.id === url.id)
                messages.push(`[${existing.name}](${existing.url}) has already been added to your account.`);
                continue;
            };
            const game = gameData.find( g => g.domain_name === url.domain);
            const modData = await nexusAPI.modInfo(userData, url.domain, url.id).catch((err) => {
                if (err.message && err.message.indexOf('404') !== -1) {
                    // If we get a "not found" error from the API.
                    messages.push(`Mod #${url.id} for ${game.name} could not be found.`);
                }
                else throw new Error(err);
            });
            if (!modData) continue;

            // Handle mods with a status other than published
            if (modData.status !== "published") {
                if (modData.status === "not_published") messages.push(`[Mod #${url.id}](${url.url}) for ${game.name} is not published. Please publish it before adding it to your account.`);
                else if (modData.status === "hidden") messages.push(`[Mod #${url.id}](${url.url}) for ${game.name} is hidden. Please unhide it before adding it to your account.`);
                else if (modData.status === "under_moderation") messages.push(`[Mod #${url.id}](${url.url}) for ${game.name} has been locked by a moderator. Please contact the Nexus Mods team for further information.`);
                else if (modData.status === "wastebinned" || "removed") messages.push(`[Mod #${url.id}](${url.url}) for ${game.name} has been deleted and cannot be added to your account.`);
                else messages.push(`[Mod #${url.id}](${url.url}) for ${game.name} has a status of ${modData.status} and cannot be added to your account.`);
                continue;
            };

            // Make sure they are the uploader of this mod. 
            if (modData.user.member_id !== userData.id) {
                messages.push(`[${modData.name || `Mod #${url.id}`}](https://www.nexusmods.com/${game.domain_name}/mods/${modData.mod_id}) was uploaded by [${modData.user.name}](https://www.nexusmods.com/users/${modData.user.member_id}) so it cannot be added to your account.`);
                continue;
            };
            const downloadData = await nexusAPI.getDownloads(userData, url.domain, game.id, url.id);
            const newMod = {
                domain: url.domain,
                mod_id: url.id,
                name: modData.name,
                game: game.name,
                unique_downloads: downloadData.unique_downloads,
                total_downloads: downloadData.total_downloads,
                path: `${url.domain}/mods/${url.id}`,
                owner: userData.id
            }
            await createMod(newMod);
            newMods.push(newMod);
        }

        const completeEmbed = new Discord.RichEmbed()
        .setTitle("Mod search complete")
        .setColor(0xda8e35)
        .setFooter(`Nexus Mods API link - ${message.author.tag}: !nm addmodurl`,client.user.avatarURL)
        .setDescription(`Added ${newMods.length} mod(s) to your account. ${messages.length ? `Unable to added ${messages.length} mod(s).` : ""}`);
        if (newMods.length) completeEmbed.addField("Added Mods", newMods.map(mod => `[${mod.name}](${mod.url}) for ${mod.game} (${mod.total_downloads} downloads)`));
        if (messages.length) completeEmbed.addField("Warnings", messages.join('\n'));
        workingMessage.edit(completeEmbed);

    }
    catch(err) {
        // console.log(err);
        return workingMessage.edit("An error occurred with your request.\n```"+err+"\n"+err.stack+"```", {embed: null});
    }


}