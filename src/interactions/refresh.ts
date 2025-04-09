import { DiscordInteraction } from "../types/DiscordTypes";
import { NexusUser } from "../types/users";
import { getUserByDiscordId } from '../api/bot-db';
import { CommandInteraction, Snowflake, EmbedBuilder, Client, User, SlashCommandBuilder, ChatInputCommandInteraction, InteractionContextType } from "discord.js";
import { KnownDiscordServers, Logger } from '../api/util';
import { DiscordBotUser } from "../api/DiscordBotUser";

const cooldown: number = (1*60*1000);

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Update your profile card.')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
    public: true,
    guilds: [
        KnownDiscordServers.BotDemo
    ],
    action
}

interface MetaData { modauthor?: '1' | '0', premium?: '1' | '0', supporter?: '1' | '0' };

const updateMeta = (prev: MetaData, cur: MetaData): boolean => {
    for (const key of Object.keys(prev)) {
        if (prev[key as keyof MetaData] != cur[key as keyof MetaData]) {
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

async function action(client: Client, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // Get sender info.
    const discordId: Snowflake | undefined = interaction.user.id;
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
            await interaction.editReply('You haven\'t linked your account yet. Use the /link command to get started.');
            return;
        }
        else if (nextUpdate > new Date()) {
            await interaction.editReply({ embeds: [ cancelCard(client, userData, interaction.user) ] }).catch((err) => logger.warn('Error updating interaction reply', { err }));;
            return;
        }
        else {
            card = replyCard(client, userData, interaction.user);
            await interaction.editReply({ embeds: [ card ] }).catch((err) => logger.warn('Error updating interaction reply', { err }));;
        }
    }
    catch(err) {
        logger.warn('Error checking if user exists in DB when linking', err);
        await interaction.editReply('An error occurred fetching your account details.').catch((err) => logger.warn('Error updating interaction reply', { err }));;
        return;
    }

    let newData: Partial<NexusUser> = {};
    newData.lastupdate = new Date();
    // Master check if we need to update roles
    // let updateRoles: boolean = false; 

    // Update membership status.
    try {
        await userData.NexusMods.Auth();
        const newfields = await userData.NexusMods.Refresh();        
        if (newfields.length > 0) {
            const updatedFields: string[] = getFieldNames(newfields);
            card.addFields({ name: 'User Info', value: `Updated:\n ${updatedFields.join('\n')}`});
            // updateRoles = true;
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
                logger.warn('Discord metadata update error', (err as Error).message);
                if ((err as Error).message === 'No Discord tokens') card.addFields({ name: 'Linked Roles', value: 'If you would like to use linked roles, please [re-authorise here](https://discordbot.nexusmods.com/linked-role).'})
                else card.addFields({ name: 'Linked Roles', value: 'Could not update metadata due to an unexpected error'});                
            }
        }
        else {
            card.addFields({ name: 'User Info', value: `No changes required`});
        }

    }
    catch(err) {
        logger.warn('Error updating using info', { err, stack: (err as Error)?.stack });
        card.addFields({ name: 'User Info', value: `Error updating user info: \n${err}`});
    }

    // Update the interaction
    card.setTitle('Updating mod stats...');
    await interaction.editReply({ embeds: [card] }).catch((err) => logger.warn('Error updating interaction reply', { err }));;

    // Update the interaction
    card.setTitle('Update complete');
    await interaction.editReply({ embeds: [card] }).catch((err) => logger.warn('Error updating interaction reply', { err }));
    // // Recheck roles, if we have changed something.
    // if (updateRoles === true) await updateAllRoles(client, userData, interaction.user, false);

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