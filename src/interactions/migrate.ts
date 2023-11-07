import { ChatInputCommandInteraction, CommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getAllUsers, getUserByDiscordId, updateUser } from '../api/bot-db';
import { logMessage } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('migrate')
    .setDescription('Migrate avatars to new format.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        '581095546291355649',
        '268004475510325248',

    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.user.id;
    const botuser: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
    if (!botuser) return interaction.editReply({ content: 'Error! No linked user!' });
    try {
        await botuser.NexusMods.Auth();
        logMessage('Nexus Mods Auth verfied.');
        
        let allUsers = await getAllUsers();
        const pendingUsers = allUsers.filter(u => !u.avatar_url?.startsWith('https://avatars')).map(u => ({ d_id: u.d_id, id: u.id }));
        allUsers = []

        await interaction.editReply({ content: `Updates required for ${pendingUsers.length} users` });

        let success = 0
        let failed = 0

        for (const user of pendingUsers) {
            const avatar_url = `https://avatars.nexusmods.com/${user.id}/100`;
            try {
                logMessage('Updating avatar for '+user.id, avatar_url);
                await updateUser(user.d_id, { avatar_url });
                success += 1
            }
            catch(err) {
                logMessage('Failed to update avatar', { user, avatar_url, err });
                failed += 1
            }            
        }

        const replyText = `Finished updating avatars.\n\nSuccess: ${success}/${pendingUsers.length}\nFailed: ${failed}/${pendingUsers.length}`

        return interaction.followUp({ content: replyText });
    }
    catch(err) {
        return interaction.editReply({ content: 'Error! '+err });
    }
}

export { discordInteraction }