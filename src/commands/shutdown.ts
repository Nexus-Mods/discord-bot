import { Message, User, MessageReaction, MessageEmbed, TextChannel, ReactionCollector } from "discord.js";
import { ClientExt } from "../DiscordBot";
import { getAllServers } from "../api/bot-db";

async function run(client: ClientExt, message: Message) {
    if (message.guild || !client.config.ownerID?.includes(message.author.id)) return;

    const shutdownMsg: Message|undefined = await message.reply('Are you sure you want to shut down the Discord bot?').catch(() => undefined);
    if (!shutdownMsg) return;
    const filter = (reaction: MessageReaction, user: User) => (reaction.emoji.name === '✅' || reaction.emoji.name === '❌') && user.id === message.author.id;
    const collect: ReactionCollector = shutdownMsg?.createReactionCollector({ filter, time: 15000, max: 1 });
    shutdownMsg.react('✅');
    shutdownMsg.react('❌');

    collect.on('collect', async r => {
        if (r.emoji.name === '❌') return message.reply('Shutdown aborted.');
        await message.reply('Shutdown confirmed.');
        console.log(`${new Date().toLocaleString()} - Shutdown confirmed by ${message.author.tag}`);
        await sendShutdownMessages(client);
        client.destroy();
        process.exit();
    });

    collect.on('end', rc => !rc.size ? message.reply('Shutdown aborted.').catch(() => undefined) : undefined);

}

async function sendShutdownMessages(client: ClientExt) {
    const embed = new MessageEmbed()
    .setTitle('Nexus Mods Discord Bot is now offline.')
    .setTimestamp(new Date());

    const allServers = await getAllServers().catch(() => undefined);
    if (!allServers) return;
    const postableServers = allServers.filter(s => !!s.channel_nexus);
    for (const server of postableServers) {
        const guild = client.guilds.resolve(server.id);
        const channel = guild && server.channel_nexus ? guild.channels.resolve(server.channel_nexus) : undefined;
        if (!guild || !channel) continue;
        (channel as TextChannel).send({embeds: [embed]}).catch(() => undefined);
    }
}


export { run };