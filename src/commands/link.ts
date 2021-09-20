import { Client, Message, MessageEmbed, TextChannel, GuildChannel, DMChannel, MessageCollector, User, ThreadChannel } from "discord.js";
import { BotServer } from "../types/servers";
import { getUserByDiscordId, createUser, updateAllRoles, getLinksByUser, addServerLink } from '../api/bot-db';
import { validate } from '../api/nexus-discord';
import { NexusUser, NexusUserServerLink } from "../types/users";
import errorReply from "../api/errorHandler";

// Message filter to detect API keys
const apiFilter = (m: Message) => m.content.length > 50 && !m.content.includes(' ');
const apiCollectorDuration = 60000;

const help = {
    name: 'link',
    description: 'Allows linking of your Nexus Mods account to your Discord account using [your API key](https://www.nexusmods.com/users/myaccount?tab=api%20access). \n*You must send your API key in a Direct Message, once linked you can use this to toggle your account link in each server.*',
    usage: '[API Key]',
    moderatorOnly: false,
    adminOnly: false
}


async function run(client: Client, message: Message, args: string[], serverData: BotServer) {
    // Get reply channel
    const replyChannel: (GuildChannel | DMChannel | ThreadChannel | undefined | null) = serverData && serverData.channel_bot ? message.guild?.channels.resolve(serverData.channel_bot) : message.channel;
    const discordId: string = message.author.id;

    let userData: NexusUser | undefined;
    let userServers: NexusUserServerLink[] | undefined;

    try {
        userData = await getUserByDiscordId(discordId);
        userServers = userData ? await getLinksByUser(userData?.id) : undefined;
    }
    catch(err: any) {
        return (replyChannel as TextChannel).send({ embeds: [errorReply(err, message)] }).catch(() => undefined);
    }
    // If the user is already linked, toggle the server link.
    if (userData) {
        if (message.guild && !userServers?.find(link => link.server_id === message.guild?.id)) {
            await addServerLink(client, userData, message.author, message.guild)
                .catch((e: Error) => {
                    return (replyChannel as TextChannel).send(`${replyChannel === message.channel ? message.author.tag : message.author.toString()} there was an error linking your account in this server: ${e.message}`).catch(() => undefined);
                });
            return (replyChannel as TextChannel)
                .send(`${replyChannel === message.channel ? message.author.tag : message.author.toString()} your account has been linked in this server. Type \`!nexus whoami\` to see your profile card.`)
                .catch(() => undefined);
        }
        else return (replyChannel as TextChannel).send(`${replyChannel === message.channel ? message.author.tag : message.author.toString()} your Discord account is already linked to ${userData.name}${message.channel.type === 'GUILD_TEXT' ? ' in this server': ''}.`)
            .catch(() => undefined);
    }

    let apiCollect : MessageCollector;
    // If the user hasn't started this process in a DM
    if (message.channel.type !== 'DM') {
        (replyChannel as TextChannel).send(`${replyChannel === message.channel ? message.author.tag : message.author.toString()}, I've sent you a Direct Message about verifying your account. Your API key should never be posted publicly.`).catch(() => undefined);
        const author: User = message.author;
        const msg = await author.send({embeds: [sendKeyEmbed(client, message)]})
            .catch(() => {
                if (args.length > 0 && message.deletable) message.delete().catch(() => undefined);
                return (replyChannel as TextChannel).send(`${message.author.toString()} - Looks like you might have DMs disabled for this server. You\'ll need to enable them to link your account.`).catch(() => undefined);
            });
        if (!msg) return;
        apiCollect = msg.channel.createMessageCollector({ filter: apiFilter, maxProcessed: 1, time: apiCollectorDuration });
        apiCollect.on('collect', m => checkAPIKey(client, m, m.cleanContent));
        apiCollect.on('end', collected => {!collected.size ? author.send("You did not send an API key in time, please try again with `!nexus link`").catch(console.error) : undefined});
        if (args.length > 0 && message.deletable) message.delete().catch(() => undefined);
    }
    else {
        if (args.length > 0) return checkAPIKey(client, message, args[0]);
        const dm = await message.author.send({ embeds: [sendKeyEmbed(client, message)]}).catch(err => undefined);
        if (dm) {
            apiCollect = message.channel.createMessageCollector({ filter: apiFilter, maxProcessed: 1, time: apiCollectorDuration });
            apiCollect.on('collect', m => checkAPIKey(client, m, m.cleanContent));
            apiCollect.on('end', collected => {!collected.size ? message.author.send("You did not send an API key in time, please try again with `!nexus link`").catch(console.error) : undefined });
        }; 
        
    }

}

async function checkAPIKey(client: Client, message: Message, key: string): Promise<void> {
    const reply = await message.reply('Checking your API key...').catch(() => undefined);

    try {
        const apiData = await validate(key);
        const userData: NexusUser = {
            d_id: message.author.id,
            id: apiData.user_id,
            name: apiData.name,
            avatar_url: apiData.profile_url,
            apikey: key,
            supporter: (!apiData.is_premium && apiData.is_supporter),
            premium: apiData.is_premium
        }
        await createUser(userData);
        await updateAllRoles(client, userData, message.author, true);
        const links: NexusUserServerLink[] = await getLinksByUser(userData.id);

        console.log(`${new Date().toLocaleString()} - ${userData.name} linked to ${message.author.tag}`);
        if (reply) reply.edit(`You have now linked the Nexus Mods account "${userData.name}" to your Discord account in ${links.length} Discord Servers.`).catch(console.error);

    }
    catch(err) {
        reply?.edit(`Could not link your account due to the following error:\n`+err).catch(console.error);
    }
}

const sendKeyEmbed = (client: Client, message: Message): MessageEmbed => {
    const embed = new MessageEmbed()
    .setTitle('Please send your API key to link your Nexus Mods account')
    .setColor(0xda8e35)
    .setURL('https://www.nexusmods.com/users/myaccount?tab=api+access')
    .setDescription(`Please send your API key in this channel within the next ${apiCollectorDuration/1000/60} minute(s) or use the command \`!nexus link apikeyhere\`.`
    +`\nYou can get your API key by visiting your [Nexus Mods account settings](https://www.nexusmods.com/users/myaccount?tab=api+access).`)
    .setImage('https://i.imgur.com/Cb4NPv9.gif')
    .setFooter(`Nexus Mods API Link - ${message.author.tag}: ${message.cleanContent} ${message.channel}`, client.user?.avatarURL() || '');

    return embed;
}

export { run, help }