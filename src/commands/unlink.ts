import { Client, Message, TextChannel, GuildChannel, DMChannel, ThreadChannel } from 'discord.js';
import { BotServer } from '../types/servers';
import { getUserByDiscordId, deleteUser, getLinksByUser, deleteAllServerLinksByUser, deleteServerLink } from '../api/bot-db';
import { NexusUser, NexusUserServerLink } from '../types/users';

const help = {
    name: 'unlink',
    description: 'Removes the link between your Discord account and Nexus Mods account in this server. \n*Send to the bot in a Direct Message to unlink all.*',
    usage: '',
    moderatorOnly: false,
    adminOnly: false 
}

async function run(client: Client, message: Message, args: string[], serverData: BotServer) {
    // Get reply channel
    const replyChannel: (GuildChannel | DMChannel | ThreadChannel | undefined | null) = serverData && serverData.channel_bot ? message.guild?.channels.resolve(serverData.channel_bot) : message.channel;
    const replyPrefix: string = replyChannel === message.channel ? `${message.author.toString()} - `: ''
    const discordId: string = message.author.id;

    const userData: NexusUser | undefined = await getUserByDiscordId(discordId).catch(() => undefined);
    const userServers: NexusUserServerLink[] | undefined = userData ? await getLinksByUser(userData.id).catch(() => undefined) : undefined;

    // Account isn't linked.
    if (!userData) return (replyChannel as TextChannel).send('You don\'t seem to have an account linked at the moment. See `!nexus link` for more information.').catch(console.error);

    if (message.guild) {
        // Only unlink the server.
        const guildId: string = message.guild.id;
        // Not currently linked here.
        if (!userServers?.find(s => s.server_id === guildId)) return (replyChannel as TextChannel).send('You don\'t seem to have an account linked at the moment. See `!nexus link` for more information.').catch(console.error);
        await deleteServerLink(client, userData, message.author, message.guild)
            .catch((err) => console.log(`Failed to unlink ${userData.name} in ${message.guild}`, err));
        (replyChannel as TextChannel).send(`${replyPrefix}The link to your Nexus Mods account "${userData.name}" in ${message.guild.name} was removed successfully. To relink in this server type \`!nexus link\`.`).catch(console.error);
    }
    else {
        // Full unlink when sent as a DM.
        try {
            await deleteAllServerLinksByUser(client, userData, message.author)
            await deleteUser(discordId);
            (replyChannel as TextChannel).send(`The link to your Nexus Mods account "${userData.name}" in was removed successfully in ${userServers?.length || 0} servers and your API key has been removed.\nSee \`!nexus link\` to reconnect your account.`).catch(console.error);
        }
        catch(err: any) {
            await (replyChannel as TextChannel).send(`There was a problem unlinking your account: ${err.message}`).catch(() => undefined);
            console.log(`Unlink failed for ${userData.name} (${message.author.tag})`, err);
        }
    }
}

export { run, help };