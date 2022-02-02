import { CommandInteraction, Snowflake, MessageEmbed, Client, User, Guild } from "discord.js";
import { NexusUser, NexusUserServerLink } from "../types/users";
import { DiscordInteraction } from "../types/util";
import { getUserByDiscordId, createUser, updateAllRoles, getLinksByUser, addServerLink, getUserByNexusModsId, deleteUser } from '../api/bot-db';
import { validate } from '../api/nexus-discord';
import { logMessage } from '../api/util';

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'link',
        description: 'Link your Nexus Mods account to Discord.',
        options: [{
            name: 'apikey',
            type: 'STRING',
            description: 'Provide your API key for your Nexus Mods account',
            required: false,
        }]
    },
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<void> {
    logMessage('Link interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: interaction.channel?.toString(), apikey: !!interaction.options.getString('apikey') });
    const discordId: Snowflake | undefined = interaction.user.id;
    await interaction.deferReply({ephemeral: true}).catch(err => { throw err });;
    // Check if they are already linked.
    let userData : NexusUser | undefined;
    let userServers: NexusUserServerLink[] | undefined;

    try {
        userData = !!discordId ? await getUserByDiscordId(discordId) : undefined;
        userServers = userData ? await getLinksByUser(userData?.id) : undefined;
    }
    catch(err) {
        console.error('Error checking if user exists in DB when linking', err);
    }

    if (userData) {        
        if (interaction.guildId && !userServers?.find(link => link.server_id === interaction.guildId)) {
            const guild = client.guilds.cache.get(interaction.guildId)
            await addServerLink(client, userData, interaction.user, guild as Guild).catch(() => undefined);
            interaction.followUp({ content:`Your Discord account has been linked to ${userData.name} in this server.`,  ephemeral: true });
            return;
        }
        else {
            interaction.followUp({content: `Your Discord account is already linked to ${userData.name} in this server.`, ephemeral: true });
            return;
        }
    }

    const apikey = interaction.options.get('apikey');
    // Check if the user submitted their API key.
    if (!apikey) interaction.followUp({ embeds: [sendKeyEmbed(client, interaction)], ephemeral: true });
    else {
        await checkAPIKey(client, interaction, apikey.value as string);
    }
}

const sendKeyEmbed = (client: Client, interaction: CommandInteraction ): MessageEmbed => {
    const embed = new MessageEmbed()
    .setTitle('Please send your API key to link your Nexus Mods account')
    .setColor(0xda8e35)
    .setURL('https://www.nexusmods.com/users/myaccount?tab=api+access')
    .setDescription(`Please send your API key using the command \`/link apikeyhere\`.`
    +`\nYou can get your API key by visiting your [Nexus Mods account settings](https://www.nexusmods.com/users/myaccount?tab=api+access).`)
    .setImage('https://i.imgur.com/Cb4NPv9.gif')
    .setFooter({ text: `Nexus Mods API Link - ${interaction.member?.user.username}`, iconURL: client.user?.avatarURL() || '' });

    return embed;
}

async function checkAPIKey(client: Client, interact: CommandInteraction, key: string): Promise<void> {
    // const reply = await message.reply('Checking your API key...').catch(() => undefined);

    try {
        const d_id = interact.user.id;
        if (!d_id) throw new Error('Could not resolve Discord ID');
        const apiData = await validate(key);
        // Check if there is already a link with another Discord profile, if so, delete it. 
        const existing: NexusUser|undefined = await getUserByNexusModsId(apiData.user_id);
        if (!!existing) {
            console.log(`Link already exists for ${existing.name}, removing it.`);
            await deleteUser(existing.d_id).catch(() => console.error('Unable to delete existing user account', { d_id, name: existing?.name }));
        }
        // Create the new user entry. 
        const userData: NexusUser = {
            d_id,
            id: apiData.user_id,
            name: apiData.name,
            avatar_url: apiData.profile_url,
            apikey: key,
            supporter: (!apiData.is_premium && apiData.is_supporter),
            premium: apiData.is_premium
        }
        await createUser(userData);
        await updateAllRoles(client, userData, interact.user, true);
        const links: NexusUserServerLink[] = await getLinksByUser(userData.id);

        console.log(`${new Date().toLocaleString()} - ${userData.name} linked to ${interact.user.toString()}`);
        interact.followUp({ content: `You have now linked the Nexus Mods account "${userData.name}" to your Discord account in ${links.length} Discord Servers.`,  ephemeral: true });

    }
    catch(err) {
        interact.followUp({ content: `Could not link your account due to the following error:\n`+err,  ephemeral: true });
    }
}

export { discordInteraction };
