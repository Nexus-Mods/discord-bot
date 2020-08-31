import { Client, Message, GuildChannel, DMChannel, TextChannel, MessageEmbed } from "discord.js";
import { BotServer } from "../types/servers";
import { NexusUser, NexusLinkedMod } from "../types/users";
import { getUserByDiscordId, updateUser, updateAllRoles, getModsbyUser, updateMod } from "../api/bot-db";
import { validate, modInfo, getDownloads } from "../api/nexus-discord";
import { IValidateKeyResponse, IModInfo } from "@nexusmods/nexus-api";
import Bluebird from 'bluebird';
import { ModDownloadInfo } from "../types/util";

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
        // Get reply channel
        const replyChannel: (GuildChannel | DMChannel | undefined | null) = server && server.channel_bot ? message.guild?.channels.resolve(server.channel_bot) : message.channel;
        const rc: TextChannel = (replyChannel as TextChannel);
        const prefix = rc === message.channel ? '' : `${message.author.toString()} - `
        const discordId: string = message.author.id;
    
        const userData: NexusUser | undefined = await getUserByDiscordId(discordId).catch(() => undefined);
        if (!userData) return rc.send(`${prefix}You do not have a Nexus Mods account linked to your Discord profile.`).catch(err => undefined);

        let result = new MessageEmbed()
        .setTitle('Updating user data...')
        .setColor(0xda8e35)
        .setThumbnail(userData.avatar_url || message.author.avatar || '')
        .setFooter(`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`,client.user?.avatarURL() || '')

        const replyMsg = await rc.send(result).catch(() => undefined);
        
        // Spam protection
        const nextUpdate = new Date( userData.lastupdate ? userData.lastupdate.getTime() + cooldown : 0 )
        if (nextUpdate > new Date()) {
            result.setTitle('Update cancelled')
            .setDescription(`Your must wait at least ${cooldown/1000/60} minute(s) before refreshing your account.`);
            return replyMsg?.edit({ embed: result }).catch(() => undefined);
        }

        let newData: any = {};
        newData.lastupdate = new Date();

        // Update any changes to their membership, name, etc.
        try {
            const apiData: IValidateKeyResponse = await validate(userData.apikey);
            if (userData.id !== apiData.user_id) newData.id = apiData.user_id;
            if (userData.name !== apiData.name) newData.name = apiData.name;
            if (userData.avatar_url !== apiData.profile_url) newData.avatar_url = apiData.profile_url;
            if ((!apiData.is_premium && apiData.is_supporter) !== userData.supporter) newData.supporter = !userData.supporter; 
            if (userData.premium !== apiData.is_premium) newData.premium = !userData.premium;
            
            try {
                if (Object.keys(newData).length > 1) {
                    const keys = Object.keys(userData);
                    // await updateUser(discordId, newData);
                    // await updateAllRoles(client, userData, message.author);
                    result.addField('User Info', `Updated ${keys.length} value(s):\n${keys.join('\n')}`);
                }
                else result.addField('User Info', 'No changes required');
                await updateUser(discordId, newData);
            }
            catch(err) {
                result.addField('User Info', `Error updating user data:\n${err}`);
            }

        }
        catch(err) {
            result.addField('User Info', `Error updating user data:\n${err}`);
        }

        await replyMsg?.edit({ embed: result }).catch(() => undefined);

        // Update download counts for mods
        try {
            const mods: NexusLinkedMod[] = await getModsbyUser(userData.id);
            const modsToUpdate: (NexusLinkedMod|undefined)[] = await Bluebird.map(mods, async (mod) => {
                const info: IModInfo = await modInfo(userData, mod.domain, mod.mod_id);
                const dls: ModDownloadInfo = await getDownloads(userData, mod.domain, info.game_id, mod.mod_id) as ModDownloadInfo;
                let newInfo: any = {};
                if (info.name && mod.name !== info.name) newInfo.name = info.name;
                if (dls.unique_downloads > mod.unique_downloads) newInfo.unique_downloads = dls.unique_downloads;
                if (dls.total_downloads > mod.total_downloads) newInfo.total_downloads = dls.total_downloads;
                if (Object.keys(newInfo).length) await updateMod(mod, newInfo);
                return Object.keys(newInfo).length ? mod : undefined;
            }).filter(m => m !== undefined);

            const displayable: string = modsToUpdate.reduce((prev, cur) => {
                const newStr = prev + `- [${cur?.name}](https://nexusmods.com/${cur?.path})\n`;
                if (newStr.length > 1024) return prev;
                else prev = newStr;
                return prev;
            }, `${modsToUpdate.length} mods updated:\n`);

            if (modsToUpdate.length) result.addField('Mods', displayable);
            else result.addField('Mods', 'No changes required.');
            
        }
        catch(err) {
            result.addField('Mods', `Error checking mod downloads:\n${err}`);
        }

        await updateAllRoles(client, userData, message.author);

        result.setTitle('Update Complete');
        await replyMsg?.edit({ embed: result }).catch(() => undefined);
}

export { run, help };