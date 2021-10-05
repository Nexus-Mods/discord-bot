import { DiscordInteraction } from "../types/util";
import { NexusUser, NexusUserServerLink } from "../types/users";
import { getAllUsers, getLinksByUser, getUserByDiscordId, userEmbed } from '../api/bot-db';
import { CommandInteraction, Snowflake, MessageEmbed, Client, User, Guild, CommandInteractionOption } from "discord.js";
import { ClientExt } from "../DiscordBot";


const discordInteraction: DiscordInteraction = {
    command: {
        name: 'whois',
        description: 'Find another user\'s profile card by Nexus Mods name or Discord ID.',
        options: [
            {
                name: 'discord',
                type: 'USER',
                description: 'Discord account',
                required: false,
            },
            {
                name: 'nexus',
                type: 'STRING',
                description: 'Nexus Mods account',
                required: false,
            },
            {
                name: 'private',
                type: 'BOOLEAN',
                description: 'Should the result only be shown to you?',
                required: false,
            }
        ]
    },
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<void> {
    // Private?
    const showValue : (CommandInteractionOption | undefined) = interaction.options.get('private');
    const show: boolean = !!showValue ? (showValue.value as boolean) : false;

    // User Ping?
    const userValue : (CommandInteractionOption | undefined) = interaction.options.get('discord');
    const user: (User | undefined) = userValue?.user;

    // Nexus search?
    const nexusValue : (CommandInteractionOption | undefined) = interaction.options.get('nexus');
    const nexus: (string | undefined) = nexusValue?.value?.toString();

    // Get sender info.
    const discordId: Snowflake | undefined = interaction.member?.user.id;
    await interaction.defer({ephemeral: show});
    // Check if they are already linked.
    let userData : NexusUser | undefined = discordId ? await getUserByDiscordId(discordId).catch(() => undefined) : undefined;

    // Currently, userEmbed requires a message, but there isn't one so we fake it until we make it. 
    const fakeMessage: any = {
        cleanContent: `/me`,
        author: {
            tag: interaction.user.tag
        }
    }

    if (!userData) {
        interaction.followUp({content: 'You need to link a Nexus Mods account to use this feature. See /link for more.', ephemeral: true});
        return;
    }

    if (!nexus && !user) {
        interaction.followUp({ content: 'You must provide a Discord user or Nexus Mods username.', ephemeral: true});
        return;
    }

    // If the bot has been pinged. 
    if (user && user === client.user) {
        interaction.followUp({ content: 'That\'s me!', embeds:[await userEmbed(botUser(client), fakeMessage, client)] })
            .catch(err => console.warn('Failed to send bot info for whois slash command', err));
        return;
    }

    try {
        const allUsers: NexusUser[] = await getAllUsers().catch(() => []);
        let foundUser: NexusUser | undefined;
        if (user) {
            foundUser = allUsers.find(u => u.d_id === user.id);
        }
        else if (nexus) {
            foundUser = allUsers.find(u => u.name.toLowerCase() === nexus.toLowerCase());
        }

        if (!foundUser) interaction.followUp(`No members found for your query.`);
        else {
            // check the linked servers for the found user
            const foundServers: NexusUserServerLink[] = await getLinksByUser(foundUser.id).catch(() => []);

            // check if we should return the result. If the found user isn't in the current server, reject the request.
            const isAdmin: boolean = (client as ClientExt).config.ownerID?.includes(interaction.user.id);
            const isMe: boolean = interaction.user.id === foundUser.d_id;
            const inGuild: boolean = !!foundServers.find(link => link.server_id === interaction.guild?.id);
            if ((!isAdmin || !isMe) && !inGuild) {
                interaction.followUp({ embeds: [ notAllowed(client) ] });
            }
            else interaction.followUp({ embeds: [await userEmbed(foundUser, fakeMessage, client)] });
        }
                        
    }
    catch (err: any) {
        interaction.followUp({ content: 'Error looking up users.', ephemeral: true});
        console.error('Error looking up users from slash command', err);
        return;
    }


}

const botUser = (client: Client): NexusUser => {
    const d_id: Snowflake = client.user?.id ? client.user?.id.toString() as Snowflake : '' as Snowflake;
    const avatar_url = client.user?.avatarURL() || '';
    const servers: NexusUserServerLink[] = client.guilds.cache.map(g => { return { server_id: g.id as Snowflake, user_id: 1234042 } })

    return {
        d_id,
        id: 1234042,
        name: 'Nexus Mods Discord Bot',
        avatar_url,
        premium: false,
        supporter: false,
        lastupdate: new Date(),
        apikey: '',
        servers
    }
}

const notAllowed = (client: Client): MessageEmbed => {
    return new MessageEmbed()
    .setTitle('⛔  Profile Unavailable')
    .setColor('#ff0000')
    .setDescription('The user you are looking for is not a member of this server.')
    .setFooter(`Nexus Mods API Link`, client.user?.avatarURL() || '');
}

export { discordInteraction };