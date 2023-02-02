import { SlashCommandBuilder, PermissionFlagsBits, CommandInteraction, ChatInputCommandInteraction } from "discord.js";
import { deleteAllServerLinksByUser, getAllMods, getAllUsers, getAllServers, 
    deleteUser, deleteMod, getAllLinks, deleteServerLinksByUserSilent, deleteServerLinksByServerSilent } from "../api/bot-db";
import { validate } from "../api/nexus-discord";
import { NexusUser } from '../types/users';
import { logMessage } from "../api/util";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";
import { NexusAPIServerError } from "../types/util";
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('cleanup')
    .setDescription('Run a database cleanup.')
    .setDMPermission(true)
    .addBooleanOption((o) =>
        o.setName('dryrun')
        .setDescription('Do not delete anything, only test.')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        '581095546291355649',
        '215154001799413770'
    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);

    const dryrun = interaction.options.getBoolean('dryrun', true);

    await interaction.reply('Starting cleanup..');

    const users = await getAllUsers();
    const serverLinks = await getAllLinks();
    const servers = await getAllServers();
    const mods = await getAllMods();

    try {
        // Clean up users
        await interaction.editReply('Cleaning up users');
        let cleanedUsers: NexusUser[] = [];
        for (const user of users) {
            const userFull = new DiscordBotUser(user);
            const apiKey = user.apikey;
            try {
                if (!!apiKey) await validate(apiKey);
                cleanedUsers.push(user);
            }
            catch(err) {
                if (err as NexusAPIServerError && (err as NexusAPIServerError).code === 401) {
                    // Invalid key.
                    const discordUser = await client.users.fetch(user.d_id);
                    if (!dryrun) await deleteUser(user.d_id);
                    if (!dryrun) await deleteAllServerLinksByUser(client, userFull, discordUser);
                    logMessage('Deleting invalid API key for ', user.name);
                }
                else logMessage('Error checking apikey', err, true);
            }
        }
        // Clean up mods
        const dirtyMods = mods.filter(m => !cleanedUsers.find(u => u.id === m.owner));
        await interaction.editReply(`Deleting ${dirtyMods.length} unused mod entries...`);
        logMessage('Unused mod entries', dirtyMods);
        if (!dryrun) await Promise.all(dirtyMods.map(async m => await deleteMod(m)));

        // Clean up links (no user)
        const dirtyUserLinks = serverLinks.filter(s => !cleanedUsers.find(u => u.id === s.user_id));
        await interaction.editReply(`Deleting ${dirtyUserLinks.length} unused server links...`);
        const usersToRemove = dirtyUserLinks.reduce((p, c) => {
            if (!p.includes(c.user_id)) p.push(c.user_id);
            return p;
        }, new Array<number>());
        logMessage('Removing users', usersToRemove.join(','));
        if (!dryrun) await Promise.all(usersToRemove.map(async u => await deleteServerLinksByUserSilent(u)));

        // Clean up links no server
        const dirtyLinks = serverLinks.filter(s => !servers.find(sv => sv.id === s.server_id));
        await interaction.editReply(`Deleting ${dirtyLinks.length} unused server links with no server...`);
        const guildsToRemove = dirtyLinks.reduce((p, c) => {
            if (!p.includes(c.server_id)) p.push(c.server_id);
            return p;
        }, new Array<string>());
        logMessage('Removing servers', guildsToRemove.join(','));
        if (!dryrun) await Promise.all(guildsToRemove.map(async u => await deleteServerLinksByServerSilent(u)));

        await interaction.editReply(`Deleting ${dirtyUserLinks.length} unused server links...`);


    }
    catch(err) {
        logMessage('Error!', err, true);
        return interaction.editReply('Failed!'+err);
    }

}

export { discordInteraction };
