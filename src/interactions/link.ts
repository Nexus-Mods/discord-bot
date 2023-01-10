import { 
    CommandInteraction, Snowflake, EmbedBuilder, Client, Guild, SlashCommandBuilder, PermissionFlagsBits, 
    ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, AnyComponentBuilder 
} from "discord.js";
import { NexusUser, NexusUserServerLink } from "../types/users";
import { DiscordInteraction } from "../types/DiscordTypes";
import { getUserByDiscordId, createUser, updateAllRoles, getLinksByUser, addServerLink, getUserByNexusModsId, deleteUser } from '../api/bot-db';
import { validate } from '../api/nexus-discord';
import { logMessage } from '../api/util';

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Nexus Mods account to Discord.')
    // .addStringOption(option => 
    //     option.setName('apikey')
    //     .setDescription('Provide your API key for your Nexus Mods account.')
    // )
    .setDMPermission(true)
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId: Snowflake = interaction.user.id;
    await interaction.deferReply({ephemeral: true}).catch(err => { throw err });;
    try {
        const userData = await getUserByDiscordId(discordId);
        const response: { embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] } = linkingEmbed(userData, discordId, client);
        return interaction.editReply(response).catch(undefined);
    }
    catch(err) {
        logMessage('Error in /link command', err, true);
        return interaction.editReply('Unexpected error! '+(err as Error).message);
    }

}

const linkingEmbed = (user: NexusUser, discordId: string, client: Client): { embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] } => {
    let components = [];
    const embed = new EmbedBuilder()
    .setColor(0xda8e35)
    .addFields([
        {
            name: 'Linked Roles',
            value: 'You can claim your roles using the "Linked Roles" option in the server drop-down menu.'
        }
    ])
    .setFooter({ text: `Nexus Mods API Link`, iconURL: client.user?.avatarURL() || '' });
    if (!!user) {
        embed.setTitle(`Your Discord account is linked with ${user.name}`)
        .setDescription('With your account linked you can now use all the features of the Discord bot!')
        .setAuthor({ name: user.name, url: `https://nexusmods.com/users/${user.id}`, iconURL: user.avatar_url });

        const unlinkButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setLabel('Unlink Account')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discordbot.nexusmods.com/revoke?id=${discordId}`)
        );
        components.push(unlinkButton);

    }
    else {
        embed.setTitle('Connect your Discord account')
        .setURL(`https://discordbot.nexusmods.com/linked-role?id=${discordId}`)
        .setDescription(`Linking your account will allow you to use Game Feeds, Search and more!\n\n[**Link my account**](https://discordbot.nexusmods.com/linked-role?id=${discordId})`)
        
        const linkButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setLabel('Link Account')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discordbot.nexusmods.com/linked-role?id=${discordId}`)
        );
        components.push(linkButton);
    }

    return { embeds : [embed], components: (components as ActionRowBuilder<ButtonBuilder>[] ) };
}

async function oldaction(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // logMessage('Link interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name, apikey: !!interaction.options.getString('apikey') });
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
        logMessage('Error checking if user exists in DB when linking', err, true);
    }

    if (userData) {        
        if (interaction.guildId && !userServers?.find(link => link.server_id === interaction.guildId)) {
            const guild = client.guilds.cache.get(interaction.guildId)
            await addServerLink(client, userData, interaction.user, guild as Guild).catch(() => undefined);
            await interaction.followUp({ content:`Your Discord account has been linked to ${userData.name} in this server.`,  ephemeral: true });
            return;
        }
        else {
            await interaction.followUp({content: `Your Discord account is already linked to ${userData.name} in this server.`, ephemeral: true });
            return;
        }
    }

    const apikey = interaction.options.get('apikey');
    // Check if the user submitted their API key.
    if (!apikey) await interaction.followUp({ embeds: [sendKeyEmbed(client, interaction)], ephemeral: true });
    else {
        await checkAPIKey(client, interaction, apikey.value as string);
    }
}

const sendKeyEmbed = (client: Client, interaction: CommandInteraction ): EmbedBuilder => {
    const embed = new EmbedBuilder()
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
            logMessage(`Link already exists for ${existing.name}, removing it.`);
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
            modauthor: apiData.is_ModAuthor,
            premium: apiData.is_premium
        }
        await createUser(userData);
        await updateAllRoles(client, userData, interact.user, true);
        const links: NexusUserServerLink[] = await getLinksByUser(userData.id);

        logMessage(`${userData.name} linked to ${interact.user.tag}`);
        await interact.followUp({ content: `You have now linked the Nexus Mods account "${userData.name}" to your Discord account in ${links.length} Discord Servers.`,  ephemeral: true });

    }
    catch(err) {
        await interact.followUp({ content: `Could not link your account due to the following error:\n${(err as any)?.message || err}`,  ephemeral: true });
    }
}

export { discordInteraction };
