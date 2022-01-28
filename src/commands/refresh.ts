import { Client, Message, GuildChannel, PartialDMChannel, DMChannel, TextChannel, MessageEmbed, ThreadChannel } from "discord.js";
import { BotServer } from "../types/servers";
import { NexusUser, NexusLinkedMod } from "../types/users";
import { getUserByDiscordId, updateUser, updateAllRoles, getModsbyUser, updateMod, modUniqueDLTotal, deleteMod } from "../api/bot-db";
import { validate, modInfo, getDownloads } from "../api/nexus-discord";
import { IValidateKeyResponse, IModInfo } from "@nexusmods/nexus-api";
import Bluebird from 'bluebird';
import { ModDownloadInfo } from "../types/util";
import { discontinuedEmbed } from '../api/util';

const cooldown:number = (1*60*1000)

const help = {
    name: "refresh",
    description: "Refresh your profile card and mod downloads.",
    usage: "",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

async function run(client: Client, message: Message, args: string[], server: BotServer) {
        return message.reply({ embeds:[discontinuedEmbed('/refresh')] }).catch(undefined);
    
    // // Get reply channel
    // const replyChannel: (GuildChannel| PartialDMChannel | DMChannel | ThreadChannel | undefined | null) = server && server.channel_bot ? message.guild?.channels.resolve(server.channel_bot) : message.channel;
    // const rc: TextChannel = (replyChannel as TextChannel);
    // const prefix = rc === message.channel ? '' : `${message.author.toString()} - `
    // const discordId: string = message.author.id;

    // const userData: NexusUser | undefined = await getUserByDiscordId(discordId).catch(() => undefined);
    // if (!userData) return rc.send(`${prefix}You do not have a Nexus Mods account linked to your Discord profile.`).catch(err => undefined);

    // let result = new MessageEmbed()
    // .setTitle('Updating user data...')
    // .setColor(0xda8e35)
    // .setThumbnail(userData.avatar_url || message.author.avatar || '')
    // .setFooter({ text: `Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL: client.user?.avatarURL() || '' })

    // const replyMsg = await rc.send({ embeds: [result] }).catch(() => undefined);
    
    // // Spam protection
    // const nextUpdate = new Date( userData.lastupdate ? userData.lastupdate.getTime() + cooldown : 0 )
    // if (nextUpdate > new Date()) {
    //     result.setTitle('Update cancelled')
    //     .setDescription(`You must wait at least ${cooldown/1000/60} minute(s) before refreshing your account.`);
    //     return replyMsg?.edit({ embeds: [result] }).catch(() => undefined);
    // }

    // let newData: any = {};
    // newData.lastupdate = new Date();

    // // Update any changes to their membership, name, etc.
    // try {
    //     const apiData: IValidateKeyResponse = await validate(userData.apikey);
    //     if (userData.id !== apiData.user_id) newData.id = apiData.user_id;
    //     if (userData.name !== apiData.name) newData.name = apiData.name;
    //     if (userData.avatar_url !== apiData.profile_url) newData.avatar_url = apiData.profile_url;
    //     if ((!apiData.is_premium && apiData.is_supporter) !== userData.supporter) newData.supporter = !userData.supporter; 
    //     if (userData.premium !== apiData.is_premium) newData.premium = !userData.premium;
        
    //     try {
    //         if (Object.keys(newData).length > 1) {
    //             const keys = Object.keys(newData);
    //             result.addField('User Info', `Updated ${keys.length} value(s):\n${keys.join('\n')}`);
    //         }
    //         else result.addField('User Info', 'No changes required');
    //         await updateUser(discordId, newData);
    //         await updateAllRoles(client, userData, message.author, false);
    //     }
    //     catch(err) {
    //         result.addField('User Info', `Error updating user data:\n${err}`);
    //     }

    // }
    // catch(err) {
    //     result.addField('User Info', `Error updating user data:\n${err}`);
    // }

    // await replyMsg?.edit({ embeds: [result] }).catch(() => undefined);

    // // Update download counts for mods
    // try {
    //     const mods: NexusLinkedMod[] = await getModsbyUser(userData.id);
    //     // Using the "any" type is the result of the map is a bastardisation of IModInfo and NexusLinkedMod
    //     let updatedMods: any[] = [];
    //     let deletedMods: any[] = [];
    //     const allMods = await Bluebird.map(mods, async (mod) => {
    //         const info: IModInfo = await modInfo(userData, mod.domain, mod.mod_id);
    //         if (info.status === "removed" || info.status ===  "wastebinned") {
    //             // If the mod page has been removed, remove it from our database. 
    //             await deleteMod(mod);
    //             deletedMods.push(mod);
    //             return mod;
    //         }
    //         const dls: ModDownloadInfo = await getDownloads(userData, mod.domain, info.game_id, mod.mod_id) as ModDownloadInfo;
    //         let newInfo: any = {};
    //         if (info.name && mod.name !== info.name) newInfo.name = info.name;
    //         if (dls.unique_downloads > mod.unique_downloads) newInfo.unique_downloads = dls.unique_downloads;
    //         if (dls.total_downloads > mod.total_downloads) newInfo.total_downloads = dls.total_downloads;
    //         if (Object.keys(newInfo).length) {
    //             await updateMod(mod, newInfo);
    //             mod = { ...info, ...newInfo };
    //             updatedMods.push(mod);
    //         }
    //         return mod;
    //     });

    //     const displayable: string = updatedMods.reduce((prev, cur) => {
    //         const newStr = prev + `- [${cur?.name}](https://nexusmods.com/${cur?.domain_name}/mods/${cur?.mod_id})\n`;
    //         if (newStr.length > 1024) return prev;
    //         else prev = newStr;
    //         return prev;
    //     }, `${updatedMods.length} mods updated:\n`);

    //     const udlTotal: number = modUniqueDLTotal(allMods.filter(mod => deletedMods.indexOf(mod) === -1));

    //     if (updatedMods.length) result.addField(`Mods (${udlTotal.toLocaleString()} unique downloads, ${mods.length} mods)`, displayable);
    //     else result.addField(`Mods (${udlTotal.toLocaleString()} unique downloads, ${mods.length} mods)`, 'No changes required.');
        
    // }
    // catch(err) {
    //     result.addField('Mods', `Error checking mod downloads:\n${err}`);
    // }

    // await updateAllRoles(client, userData, message.author);

    // result.setTitle('Update Complete');
    // await replyMsg?.edit({ embeds: [result] }).catch(() => undefined);
}

export { run, help };