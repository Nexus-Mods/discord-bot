import { ModDownloadInfo } from "../types/util";
import { DiscordInteraction } from "../types/DiscordTypes";
import { NexusLinkedMod, NexusUser } from "../types/users";
import { 
    getUserByDiscordId, getModsbyUser, deleteMod, updateMod, 
    modUniqueDLTotal, updateAllRoles 
} from '../api/bot-db';
import { CommandInteraction, Snowflake, EmbedBuilder, Client, User, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { IModInfo } from "@nexusmods/nexus-api";
import { logMessage } from '../api/util';
import { DiscordBotUser } from "../api/DiscordBotUser";

const cooldown: number = (1*60*1000);

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Update your profile card.')
    .setDMPermission(true),
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

interface MetaData { modauthor?: '1' | '0', premium?: '1' | '0', supporter?: '1' | '0' };

const updateMeta = (prev: MetaData, cur: MetaData): boolean => {
    for (const key of Object.keys(prev)) {
        if (prev[key as keyof MetaData] != cur[key as keyof MetaData]) {
            logMessage('No match for metadata key', { key, prev, cur });
            return true;
        }
    }
    return false;
};

const replyCard = (client: Client, nexus: DiscordBotUser, discord: User): EmbedBuilder => {
    let result = new EmbedBuilder()
    .setTitle('Updating user data...')
    .setColor(0xda8e35)
    .setThumbnail(nexus.NexusModsAvatar || discord.avatarURL() || '' )
    .setFooter({text: `Nexus Mods API link - ${discord.tag}`, iconURL: client.user?.avatarURL() || '' })
    return result;
}

const cancelCard = (client: Client, nexus: DiscordBotUser, discord: User) => {
    return new EmbedBuilder({
        title: 'Update cancelled',
        description: `You must wait at least ${cooldown/1000/60} minute(s) before refreshing your account.`,
        color: 0xda8e35,
        thumbnail: { url: (nexus.NexusModsAvatar || (discord.avatarURL() as string) || '') },
        footer: {
            text: `Nexus Mods API link - ${discord.tag}`,
            iconURL: client.user?.avatarURL() || ''
        }
    })
}

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // logMessage('Refresh interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name});

    // Get sender info.
    const discordId: Snowflake | undefined = interaction.user.id;
    // logMessage('Deferring reply');
    await interaction.deferReply({ephemeral: true}).catch(err => { throw err });;
    // Check if they are already linked.
    let userData : DiscordBotUser | undefined;

    let card : EmbedBuilder 
    
    try {
        userData = !!discordId ? await getUserByDiscordId(discordId) : undefined;
        const nextUpdate = new Date( userData?.LastUpdated ? userData.LastUpdated.getTime() + cooldown : 0 );
        try { 
            await userData?.NexusMods.Auth()
        }
        catch(err) {
            return interaction.editReply({ content: 'There was a problem authorising your Nexus Mods account. Use /link to refresh your tokens.' });
        }
        if (!userData) {
            // logMessage('Editing reply, no user data');
            await interaction.editReply('You haven\'t linked your account yet. Use the /link command to get started.');
            return;
        }
        else if (nextUpdate > new Date()) {
            // logMessage('Editing reply, too soon.');
            await interaction.editReply({ embeds: [ cancelCard(client, userData, interaction.user) ] }).catch((err) => logMessage('Error updating interaction reply', { err }, true));;
            return;
        }
        else {
            card = replyCard(client, userData, interaction.user);
            // logMessage('Editing reply, first reply');
            await interaction.editReply({ embeds: [ card ] }).catch((err) => logMessage('Error updating interaction reply', { err }, true));;
        }
    }
    catch(err) {
        logMessage('Error checking if user exists in DB when linking', err, true);
        // logMessage('Editing reply, error');
        await interaction.editReply('An error occurred fetching your account details.').catch((err) => logMessage('Error updating interaction reply', { err }, true));;
        return;
    }

    let newData: Partial<NexusUser> = {};
    newData.lastupdate = new Date();
    // Master check if we need to update roles
    let updateRoles: boolean = false; 

    // Update membership status.
    try {
        await userData.NexusMods.Auth();
        const newfields = await userData.NexusMods.Refresh();        
        if (newfields.length > 0) {
            const updatedFields: string[] = getFieldNames(newfields);
            card.addFields({ name: 'User Info', value: `Updated:\n ${updatedFields.join('\n')}`});
            updateRoles = true;
            try {
                const oldmeta = await userData.Discord.GetRemoteMetaData();
                if (!oldmeta) throw new Error('No Discord tokens');
                const meta = await userData.Discord.BuildMetaData();
                if (updateMeta(oldmeta.metadata, meta)) {
                    await userData.Discord.PushMetaData(meta);
                    card.addFields({ name: 'Linked Roles', value: 'Updated successfully!'});
                }
                else card.addFields({ name: 'Linked Roles', value: 'No changes required'});
            }
            catch(err) {
                logMessage('Discord metadata update error', (err as Error).message, true);
                if ((err as Error).message === 'No Discord tokens') card.addFields({ name: 'Linked Roles', value: 'If you would like to use linked roles, please [re-authorise here](https://discordbot.nexusmods.com/linked-role).'})
                else card.addFields({ name: 'Linked Roles', value: 'Could not update metadata due to an unexpected error'});                
            }
        }
        else {
            card.addFields({ name: 'User Info', value: `No changes required`});
        }

    }
    catch(err) {
        logMessage('Error updating using info', { err, stack: (err as Error)?.stack }, true);
        card.addFields({ name: 'User Info', value: `Error updating user info: \n${err}`});
    }

    // Update the interaction
    // logMessage('Editing reply, updating mod stats');
    card.setTitle('Updating mod stats...');
    await interaction.editReply({ embeds: [card] }).catch((err) => logMessage('Error updating interaction reply', { err }, true));;

    // Update download counts for the mods
    try {
        const mods: NexusLinkedMod[] = await getModsbyUser(userData.NexusModsId).catch(() => []);
        if (mods.length) {
            let updatedMods: (Partial<IModInfo | NexusLinkedMod>)[] = [];
            let deletedMods: (Partial<IModInfo | NexusLinkedMod>)[] = [];
            // Map over all the mods
            const allMods = await Promise.all(mods.map(async (mod) => {
                const info = (await userData?.NexusMods.API.v2.Mod(mod.domain, mod.mod_id))?.[0];
                if (!info) return mod;
                if (['removed', 'wastebinned'].includes(info.status)) {
                    // Mod has been deleted
                    await deleteMod(mod);
                    deletedMods.push(mod);
                    return mod;
                }
                const dls: ModDownloadInfo = await userData?.NexusMods.API.Other.ModDownloads(info.game.id, mod.mod_id) as ModDownloadInfo || { unique_downloads: 0, total_downloads: 0 };
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
            }));

            const displayable: string = updatedMods.reduce((prev, cur: any) => {
                const newStr = prev + `- [${cur?.name}](https://nexusmods.com/${cur?.domain_name || cur.domainName}/mods/${cur?.mod_id})\n`;
                if (newStr.length > 1024) return prev;
                else prev = newStr;
                return prev;
            }, `${updatedMods.length} mods updated:\n`);

            const udlTotal: number = modUniqueDLTotal(allMods.filter(mod => deletedMods.indexOf(mod) === -1));

            if (updatedMods.length) card.addFields({ name: `Mods (${udlTotal.toLocaleString()} unique downloads, ${mods.length} mods)`, value: displayable});
            else card.addFields({ name: `Mods (${udlTotal.toLocaleString()} unique downloads, ${mods.length} mods)`, value: 'No changes required.'});
        }

    }
    catch(err) {
        card.addFields({ name: 'Mods', value: `Error checking mod downloads:\n${err}`});
    }

    // Update the interaction
    card.setTitle('Update complete');
    // logMessage('Editing reply, update complete');
    await interaction.editReply({ embeds: [card] }).catch((err) => logMessage('Error updating interaction reply', { err }, true));
    // // Recheck roles, if we have changed something.
    // if (updateRoles === true) await updateAllRoles(client, userData, interaction.user, false);
    // else logMessage('User data has not changed, no role update needed', { user: interaction.user.tag });

}

function getFieldNames(keys: string[]): string[] {
    return keys.map(k => {
        switch(k) {
            case 'id': return '- User ID';
            case 'name': return '- Username';
            case 'avatar_url': return '- Profile Image';
            case 'supporter': return '- Supporter Membership';
            case 'premium': return '- Premium Membership';
            case 'modauthor': return '- Mod Author status';
            case 'lastupdate': return '- Last updated time';
            default: return k;

        }
    });
}

export { discordInteraction };