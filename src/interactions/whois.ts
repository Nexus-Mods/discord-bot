import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { NexusUser } from "../types/users";
import { getAllUsers, getUserByDiscordId, userEmbed, userProfileEmbed } from '../api/bot-db';
import { Snowflake, EmbedBuilder, Client, User, ChatInputCommandInteraction, SlashCommandBuilder, CommandInteraction, MessageFlags, InteractionContextType } from "discord.js";
import { KnownDiscordServers, Logger } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";


const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Find another user\'s profile card by Nexus Mods name or Discord ID.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption(option => 
      option.setName('discord')
      .setDescription('Discord account')
      .setRequired(false)
    )
    .addStringOption(option => 
        option.setName('nexus')
        .setDescription('Nexus Mods account') 
        .setRequired(false)   
    )
    .addBooleanOption(option => 
        option.setName('private')
        .setDescription('Should the result only be shown to you?')    
        .setRequired(false)
    ) as SlashCommandBuilder,
    public: true,
    guilds: [
        KnownDiscordServers.BotDemo
    ],
    action
}

async function action(client: Client, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // Private?
    const showValue : (boolean | null) = interaction.options.getBoolean('private');
    const show: boolean = showValue !== null ? showValue : true;

    // User Ping?
    const user : (User | null) = interaction.options.getUser('discord');

    // Nexus search?
    const nexus : (string | null) = interaction.options.getString('nexus');

    // Get sender info.
    const discordId: Snowflake | undefined = interaction.user.id;
    await interaction.deferReply({ephemeral: show}).catch(err => { throw err });
    // Check if they are already linked.
    let userData : DiscordBotUser | undefined = discordId ? await getUserByDiscordId(discordId).catch(() => undefined) : undefined;

    if (!userData) {
        interaction.followUp({content: 'You need to link a Nexus Mods account to use this feature. See /link for more.', flags: MessageFlags.Ephemeral});
        return;
    }

    if (!nexus && !user) {
        interaction.followUp({ content: 'You must provide a Discord user or Nexus Mods username.', flags: MessageFlags.Ephemeral});
        return;
    }

    // If the bot has been pinged. 
    if (user && user === client.user) {
        interaction.followUp({ content: 'That\'s me!', embeds:[await userEmbed(botUser(client), client)], flags: show ? MessageFlags.Ephemeral : undefined })
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

        if (!foundUser) interaction.followUp({content: 'No members found for your query.', ephemeral: true});
        else {
            const botUser = new DiscordBotUser(foundUser, logger);
            // check if we should return the result. If the found user isn't in the current server, reject the request.
            const isAdmin: boolean = (client as ClientExt).config.ownerID?.includes(interaction.user.id);
            const isMe: boolean = interaction.user.id === botUser.DiscordId;
            const inGuild: boolean = !!interaction.guild //!!foundServers.find(link => link.server_id === interaction.guild?.id);
            if (isAdmin || isMe || inGuild) interaction.followUp({ embeds: [await userProfileEmbed(botUser, client)], ephemeral: show });
            else {
                logger.info('Whois not authorised', {requester: userData, target: botUser, isAdmin, isMe, inGuild});
                interaction.followUp({ embeds: [ notAllowed(client) ], flags: MessageFlags.Ephemeral });
            };
        }
                        
    }
    catch (err) {
        interaction.followUp({ content: 'Error looking up users.', flags: MessageFlags.Ephemeral});
        logger.warn('Error looking up users from slash command', err);
        return;
    }


}

const botUser = (client: Client): NexusUser => {
    const d_id: Snowflake = client.user?.id ? client.user?.id.toString() as Snowflake : '' as Snowflake;
    const avatar_url = client.user?.avatarURL() || '';
    return {
        d_id,
        id: 1234042,
        name: 'Nexus Mods Discord Bot',
        avatar_url,
        premium: false,
        supporter: false,
        lastupdate: new Date()
    }
}

const notAllowed = (client: Client): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle('⛔  Profile Unavailable')
    .setColor('#ff0000')
    .setDescription('The user you are looking for is not a member of this server.')
    .setFooter({ text: `Nexus Mods API Link`, iconURL: client.user?.avatarURL() || '' });
}

export { discordInteraction };