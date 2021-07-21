import { CommandInteraction, Snowflake, Client, Guild } from "discord.js";
import { NexusUser, NexusUserServerLink } from "../types/users";
import { DiscordInteraction } from "../types/util";
import { getUserByDiscordId, getLinksByUser, deleteAllServerLinksByUser, deleteUser, deleteServerLink } from '../api/bot-db';

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'unlink',
        description: 'Delete the link between your Nexus Mods account and Discord.',
        options: [{
            name: 'global',
            type: 'BOOLEAN',
            description: 'Delete from all servers. (Otherwise just unlink in this server.)',
            required: true,
        }]
    },
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<void> {
    const discordId: Snowflake | undefined = interaction.member?.user.id;
    await interaction.defer({ephemeral: true});
    const global: boolean = interaction.options.get('apikey')?.value as boolean || false;
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

            const userServers: NexusUserServerLink[] = await getLinksByUser(userData.id).catch(() => []);
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