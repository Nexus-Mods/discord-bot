import { Client, Message, MessageEmbed } from "discord.js";
import { getAllUsers, getAllGameFeeds } from "../api/bot-db";
import { CommandHelp } from "../types/util";
import { NexusUser } from "../types/users";
import { GameFeed } from "../types/feeds";
import { uptime } from "process";

const help: CommandHelp = {
    name: 'about',
    description: 'Bot information and stats.',
    usage: '',
    moderatorOnly: false,
    adminOnly: false
}

async function run(client: Client, message: Message) {
    const upTime: string = calcUptime(process.uptime());
    const allUsers: NexusUser[] = await getAllUsers();
    const allFeeds: GameFeed[] = await getAllGameFeeds();
    const info: MessageEmbed = new MessageEmbed()
    .setTitle('Nexus Mods Discord Bot')
    .setColor(0xda8e35)
    .setThumbnail(client.user?.avatarURL() || '')
    .setDescription(
        `**Version:** ${process.env.npm_package_version}\n`+
        `**Source:** [GitHub](https://github.com/Nexus-Mods/discord-bot)\n\n`+
        `Integrate your community with Nexus Mods with our Disord bot. Link accounts, search, get notified of the latest mod for your favourite games and more.`
    )
    .addField('Support', 'If you have feedback or questions about this bot, head over to the [Nexus Mods Discord Server](https://discord.gg/nexusmods).')
    .addField('Stats', 
        `Servers: ${client.guilds.cache.size.toLocaleString()}\n`+
        `Users: ${client.users.cache.size.toLocaleString()}\n`+
        `Linked Accounts: ${allUsers.length.toLocaleString()}\n`+
        `Game Feeds: ${allFeeds.length.toLocaleString()}`
    )
    .setFooter(`Uptime: ${upTime}`, client.user?.avatarURL() || '')
    .setTimestamp(new Date());

    return message.channel.send(info);
    
}

function calcUptime(seconds: number): string {
    const days = Math.floor(seconds/86400);
    seconds -= (days * 86400);
    const hours = Math.floor(seconds/3600);
    seconds -= (hours * 3600);
    const minutes = Math.floor(seconds/60);
    seconds -= (minutes * 60);
    return `${days}d ${hours}h ${minutes}m ${seconds.toFixed()}s`;
}


export { run, help }