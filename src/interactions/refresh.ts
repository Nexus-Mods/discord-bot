import Bluebird from 'bluebird';
import { DiscordInteraction, ModDownloadInfo } from "../types/util";
import { NexusLinkedMod, NexusUser } from "../types/users";
import { 
    getUserByDiscordId, updateUser, getModsbyUser, deleteMod, updateMod, 
    modUniqueDLTotal, updateAllRoles 
} from '../api/bot-db';
import { CommandInteraction, Snowflake, MessageEmbed, Client, User } from "discord.js";
import { IModInfo, IValidateKeyResponse } from "@nexusmods/nexus-api";
import { getDownloads, modInfo, validate } from "../api/nexus-discord";
import { logMessage } from '../api/util';

const cooldown: number = (1*60*1000);

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'refresh',
        description: 'Update your profile card.',
        options: []
    },
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

const replyCard = (client: Client, nexus: NexusUser, discord: User): MessageEmbed => {
    let result = new MessageEmbed()
    .setTitle('Updating user data...')
    .setColor(0xda8e35)
    .setThumbnail(nexus.avatar_url || discord.avatarURL() || '' )
    .setFooter({text: `Nexus Mods API link - ${discord.tag}`, iconURL: client.user?.avatarURL() || '' })
    return result;
}

const cancelCard = (client: Client, nexus: NexusUser, discord: User) => {
    return new MessageEmbed({
        title: 'Update cancelled',
        description: `You must wait at least ${cooldown/1000/60} minute(s) before refreshing your account.`,
        color: 0xda8e35,
        thumbnail: { url: (nexus.avatar_url || (discord.avatarURL() as string) || '') },
        footer: {
            text: `Nexus Mods API link - ${discord.tag}`,
            iconURL: client.user?.avatarURL() || ''
        }
    })
}

async function action(client: Client, interaction: CommandInteraction): Promise<any> {
    // logMessage('Refresh interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name});

    // Get sender info.
    const discordId: Snowflake | undefined = interaction.user.id;
    await interaction.deferReply({ephemeral: true}).catch(err => { throw err });;
    // Check if they are already linked.
    let userData : NexusUser | undefined;

    let card : MessageEmbed 
    
    try {
        userData = !!discordId ? await getUserByDiscordId(discordId) : undefined;
        const nextUpdate = new Date( userData?.lastupdate ? userData.lastupdate.getTime() + cooldown : 0 )
        if (!userData) {
            await interaction.editReply('You haven\'t linked your account yet. Use the /link command to get started.');
            return;
        }
        else if (nextUpdate > new Date()) {
            await interaction.editReply({ embeds: [ cancelCard(client, userData, interaction.user) ] }).catch((err) => logMessage('Error updating interaction reply', { err }, true));;
            return;
        }
        else {
            card = replyCard(client, userData, interaction.user);
            await interaction.editReply({ embeds: [ card ] }).catch((err) => logMessage('Error updating interaction reply', { err }, true));;
        }
    }
    catch(err) {
        logMessage('Error checking if user exists in DB when linking', err, true);
        await interaction.editReply('An error occurred fetching your account details.').catch((err) => logMessage('Error updating interaction reply', { err }, true));;
        return;
    }

    let newData: Partial<NexusUser> = {};
    newData.lastupdate = new Date();
    // Master check if we need to update roles
    let updateRoles: boolean = false; 

    // Update membership status.
    try {
        // Check the API key
        const apiData: IValidateKeyResponse = await validate(userData.apikey);
        if (userData.id !== apiData.user_id) newData.id = apiData.user_id;
        if (userData.name !== apiData.name) newData.name = apiData.name;
        if (userData.avatar_url !== apiData.profile_url) newData.avatar_url = apiData.profile_url;
        if ((!apiData.is_premium && apiData.is_supporter) !== userData.supporter) newData.supporter = !userData.supporter;
        if (userData.premium !== apiData.is_premium) newData.premium = apiData.is_premium;
        
        if (Object.keys(newData).length > 1) {
            const updatedFields: string[] = getFieldNames(Object.keys(newData));
            card.addField('User Info', `Updated:\n ${updatedFields.join('\n')}`);
            await updateUser(discordId, newData);
            updateRoles = true;
        }
        else {
            card.addField('User Info', `No changes required`);
        }

    }
    catch(err) {
        card.addField('User Info', `Error updating user info: \n${err}`);
    }

    // Update the interaction
    card.setTitle('Updating mod stats...');
    await interaction.editReply({ embeds: [card] }).catch((err) => logMessage('Error updating interaction reply', { err }, true));;

    // Update download counts for the mods
    try {
        const mods: NexusLinkedMod[] = await getModsbyUser(userData.id).catch(() => []);
        if (mods.length) {
            let updatedMods: (Partial<IModInfo | NexusLinkedMod>)[] = [];
            let deletedMods: (Partial<IModInfo | NexusLinkedMod>)[] = [];
            // Map over all the mods
            const allMods = await Bluebird.map(mods, async (mod) => {
                const info: IModInfo = await modInfo(userData as NexusUser, mod.domain, mod.mod_id);
                if (!info) return mod;
                if (['removed', 'wastebinned'].includes(info.status)) {
                    // Mod has been deleted
                    await deleteMod(mod);
                    deletedMods.push(mod);
                    return mod;
                }
                const dls: ModDownloadInfo = await getDownloads(userData as any, mod.domain, info.game_id, mod.mod_id) as ModDownloadInfo;
                let newInfo: Partial<NexusLinkedMod> = {};
                // Compare any changes
                if (info.name && mod.name !== info.name) newInfo.name = info.name;
                if (dls.unique_downloads > mod.unique_downloads) newInfo.unique_downloads = dls.unique_downloads;
                if (dls.total_downloads > mod.total_downloads) newInfo.total_downloads = dls.total_downloads;
                if (Object.keys(newInfo).length) {
                    updateRoles = true;
                    await updateMod(mod, newInfo);
                    mod = { ...info, ...newInfo } as any;
                    updatedMods.push(mod);
                }
                return mod;
            });

            const displayable: string = updatedMods.reduce((prev, cur: any) => {
                const newStr = prev + `- [${cur?.name}](https://nexusmods.com/${cur?.domain_name}/mods/${cur?.mod_id})\n`;
                if (newStr.length > 1024) return prev;
                else prev = newStr;
                return prev;
            }, `${updatedMods.length} mods updated:\n`);

            const udlTotal: number = modUniqueDLTotal(allMods.filter(mod => deletedMods.indexOf(mod) === -1));

            if (updatedMods.length) card.addField(`Mods (${udlTotal.toLocaleString()} unique downloads, ${mods.length} mods)`, displayable);
            else card.addField(`Mods (${udlTotal.toLocaleString()} unique downloads, ${mods.length} mods)`, 'No changes required.');
        }

    }
    catch(err) {
        card.addField('Mods', `Error checking mod downloads:\n${err}`);
    }

    // Update the interaction
    card.setTitle('Update complete');
    await interaction.editReply({ embeds: [card] }).catch((err) => logMessage('Error updating interaction reply', { err }, true));
    // Recheck roles, if we have changed something.
    if (updateRoles === true) await updateAllRoles(client, userData, interaction.user, false);
    else logMessage('User data has not changed, no role update needed', { user: interaction.user.tag });

}

function getFieldNames(keys: string[]): string[] {
    return keys.map(k => {
        switch(k) {
            case 'id': return 'User ID';
            case 'name': return 'Username';
            case 'avatar_url': return 'Profile Image';
            case 'supporter': return 'Supporter Membership';
            case 'premium': return 'Premium Membership';
            default: return k;

        }
    });
}

export { discordInteraction };