import { CommandInteraction, Snowflake, Client, Guild, Interaction, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { NexusUser, NexusUserServerLink } from "../types/users";
import { DiscordInteraction } from "../types/DiscordTypes";
import { getUserByDiscordId, getLinksByUser, deleteAllServerLinksByUser, deleteUser, deleteServerLink } from '../api/bot-db';
import { KnownDiscordServers, logMessage } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Delete the link between your Nexus Mods account and Discord.')
    .setDMPermission(true),
    public: true,
    guilds: [
        KnownDiscordServers.BotDemo
    ],
    action
}

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId: Snowflake = interaction.user.id;
    await interaction.deferReply({ephemeral: true}).catch(err => { throw err });;
    // See if they have existing data
    const userData = await getUserByDiscordId(discordId);
    if (!!userData) {
        // Existing user
        const unlinkEmbed = [new EmbedBuilder()
        .setTitle('Unlink Nexus Mods account')
        .setColor(0xda8e35)
        .setURL(`https://discordbot.nexusmods.com/revoke?id=${discordId}`)
        .setDescription('Unlinking your account will remove all roles granted by your Nexus Mods account and you will not be able to use all features of the bot anymore.')
        .setThumbnail(userData.NexusModsAvatar || null)
        .setFooter({ text: 'Discord Bot - Nexus Mods', iconURL: client?.user?.avatarURL() || '' })];

        const unlinkButton = [new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
            .setLabel('Unlink accounts')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discordbot.nexusmods.com/revoke?id=${discordId}`)
        )];

        return interaction.editReply({ embeds: unlinkEmbed, components: unlinkButton });

    }
    else {
        // Not linked!
        const notLinkedEmbed = [new EmbedBuilder()
        .setTitle('Unlink Nexus Mods account')
        .setColor(0xda8e35)
        .setDescription('Your account is not current linked.')
        .setFooter({ text: 'Discord Bot - Nexus Mods', iconURL: client?.user?.avatarURL() || '' })];

        return interaction.editReply({ embeds: notLinkedEmbed });

    }

}

async function oldAction(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // logMessage('Unlink interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name });

    const discordId: Snowflake | undefined = interaction.member?.user.id;
    await interaction.deferReply({ephemeral: true}).catch(err => { throw err });;
    const global: boolean = interaction.options.get('global')?.value as boolean || false;
    // Check if they are already linked.
    let userData : DiscordBotUser | undefined;
    let userServers: NexusUserServerLink[] | undefined;

    try {
        userData = !!discordId ? await getUserByDiscordId(discordId) : undefined;
        userServers = userData ? await getLinksByUser(userData?.NexusModsId) : undefined;
    }
    catch(err) {
        console.error('Error checking if user exists in DB when linking', err);
    }

    if (userData) {       
        if (global) {
            // unlink globally
            try {
                await deleteAllServerLinksByUser(client, userData, interaction.user);
                await deleteUser(interaction.user.id);
                interaction.followUp('Your Nexus Mods account has been unlinked from Discord in all servers.');
                return;
            }
            catch(err) {
                console.error('Error unlinking account', { userData, err });
                interaction.followUp('There was an error deleting your account link.');
                return;
            }            

        }
        else {
            // Unlink in only this server.
            const guild : Guild | null = interaction.guild;
            const guildId: Snowflake|null = interaction.guildId;
            if (!guildId || !guild) {
                interaction.followUp('Unlink failed. Unable to resolve guild id.');
                return;
            }

            const userServers: NexusUserServerLink[] = await getLinksByUser(userData.NexusModsId).catch(() => []);
            const linkExists: NexusUserServerLink|undefined = userServers.find(link => link.server_id === guildId);
            if (!linkExists) {
                interaction.followUp('Your account is not linked in this server.');
                return;
            }

            try {
                await deleteServerLink(client, userData, interaction.user, guild);
                interaction.followUp(`Unlinked your account in ${guild.name}`);
                return;
            }
            catch(err) {
                console.error('Failed to unlink account', { userData, err });
                interaction.followUp('Failed to unlink your account. Please try again later.');
                return;
            }



        }
    }
    else {

    }
}

export { discordInteraction };