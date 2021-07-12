import { CommandInteraction, Snowflake, MessageEmbed, Client, Message, Interaction, User, Guild } from "discord.js";
import { NexusUser, NexusUserServerLink } from "../types/users";
import { DiscordInteraction } from "../types/util";
import { getUserByDiscordId, createUser, updateAllRoles, getLinksByUser, addServerLink } from '../api/bot-db';
import { validate } from '../api/nexus-discord';

const apiCollectorDuration = 60000;

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'link',
        description: 'Link your Nexus Mods account to Discord.',
        options: [{
            name: 'apikey',
            type: 'STRING',
            description: 'Blah blah blah',
            required: false,
        }]
    },
    public: false,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<void> {
    const discordId: Snowflake | undefined = interaction.member?.user.id;
    await interaction.defer({ephemeral: true});
    // Check if they are already linked.
    let userData : NexusUser | undefined;
    let userServers: NexusUserServerLink[] | undefined;

    try {
        userData = !!discordId ? await getUserByDiscordId(discordId) : undefined;
        userServers = userData ? await getLinksByUser(userData?.id) : undefined;
    }
    catch(err: any) {
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
    .setFooter(`Nexus Mods API Link - ${interaction.member?.user.username}`, client.user?.avatarURL() || '');

    return embed;
}

async function checkAPIKey(client: Client, interact: CommandInteraction, key: string): Promise<void> {
    // const reply = await message.reply('Checking your API key...').catch(() => undefined);

    try {
        const d_id = interact.member?.user.id;
        if (!d_id) throw new Error('Could not resolve Discord ID');
        const apiData = await validate(key);
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
        await updateAllRoles(client, userData, interact.member?.user as User, true);
        const links: NexusUserServerLink[] = await getLinksByUser(userData.id);

        console.log(`${new Date().toLocaleString()} - ${userData.name} linked to ${interact.member?.user.toString()}`);
        interact.followUp({ content: `You have now linked the Nexus Mods account "${userData.name}" to your Discord account in ${links.length} Discord Servers.`,  ephemeral: true });

    }
    catch(err: any) {
        interact.followUp({ content: `Could not link your account due to the following error:\n`+err,  ephemeral: true });
    }
}

export { discordInteraction };