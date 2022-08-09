import { CommandInteraction, Client, User, Role, Interaction, Guild, Collection, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, } from "../types/DiscordTypes";
import { getAllUsers, updateRoles, getServer, getLinksByServer, deleteServerLink } from '../api/bot-db';
import { NexusUser, NexusUserServerLink } from "../types/users";
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('roleaudit')
    .setDescription('Clean up bot-issued roles in this server.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(0),
    public: false,
    guilds: [
        '232168805038686208',
        '581095546291355649'
    ],
    permissions: [],
    action
}

async function action(client: Client, baseinteraction: Interaction): Promise<any> {
    const interaction = baseinteraction as CommandInteraction;
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.memberPermissions?.toArray().includes('Administrator')) return interaction.editReply('You do not have permission to use this command.');

    // Get the roles from the bot
    const guild: Guild | null = interaction.guild;
    if (!guild) return interaction.editReply('Cannot get Discord guild info');


    // Get all the known linked members.
    try {
        const allUsers: NexusUser[] = await getAllUsers();
        const links: NexusUserServerLink[] = await getLinksByServer(guild.id);
        const linkedMembers: NexusUser[] = allUsers.filter(u => !!links.find(l => l.user_id == u.id));
        logMessage('Linked members for guild', { linkedMembers: linkedMembers.length, guild: guild.name });
        const guildMembers = await guild.members.fetch({ force: true, time: 60000 });
        logMessage('Got guild members', guildMembers.size);

        for (const member of linkedMembers) {
            const discordUser: User | undefined = guildMembers.get(member.d_id)?.user;
            if (!discordUser) {
                logMessage('Could not resolve guild member for ', member.name);
                await deleteServerLink(client, member, undefined, guild);
                continue;
            }
            logMessage('Auditing roles', { nexus: member.name, discord: discordUser.tag, guild: guild.name });
            await updateRoles(client, member, discordUser, guild);
        }
        logMessage('Auditing complete');
        return interaction.editReply(`Successfully audited roles on ${linkedMembers.length} users.`);
    }
    catch(err) {
        logMessage('Error auditing roles', err, true);
        return interaction.editReply('Failed to audit users. \n\n'+err).catch(() => logMessage('Failed to audit', err));
    }

}

// export { discordInteraction };