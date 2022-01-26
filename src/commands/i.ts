import { Client, Message, GuildChannel, PartialDMChannel, DMChannel, TextChannel, MessageEmbed, ThreadChannel } from "discord.js";
import { BotServer } from "../types/servers";
import { CommandHelp, InfoCache, PostableInfo, InfoResult } from "../types/util";
import { getAllInfos, displayInfo } from "../api/bot-db";

const help: CommandHelp = {
    name: "i",
    description: "Quick command for displaying an info topic.",
    usage: "[query]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

let cachedInfo: InfoCache;

async function run(client: Client, message: Message, args: string[], server: BotServer) {
    // Get reply channel
    const replyChannel: (GuildChannel| PartialDMChannel | DMChannel | ThreadChannel | undefined | null) = server && server.channel_bot ? message.guild?.channels.resolve(server.channel_bot) : message.channel;
    const rc: TextChannel = (replyChannel as TextChannel);
    const prefix = rc === message.channel ? '' : `${message.author.toString()}`

    // if (!cachedInfo || cachedInfo.expiry < new Date()) {
    //     const data = await getAllInfos().catch(() => []);
    //     const expiry = new Date(new Date().getTime() + 5*60000);
    //     cachedInfo = { data, expiry };
    //     console.log(`${new Date().toLocaleString()} - Updated info cache.`, cachedInfo.data.length);
    // }

    // LOOK INTO CACHING ONCE THIS FEATURE IS READY TO GO
    const data: InfoResult[] = await getAllInfos().catch(() => []);


    if (!args.length) return rc.send({content: prefix, embeds: [helpEmbed(client, message, data)]}).catch(() => undefined);

    const query: string = args[0].toLowerCase();
    const result: InfoResult|undefined = data.find(i => i.name.toLowerCase() === query);
    if (!result) return rc.send({ content: prefix, embeds: [notFound(client, message, query)] }).catch(() => undefined);
    const postable: PostableInfo = displayInfo(client, message, result);
    message.channel.send({ content: postable.content || undefined, embeds: postable.embed ? [postable.embed] : undefined }).catch((err) => console.log(err));
    message.delete().catch(() => undefined);
}

const helpEmbed = (client: Client, message: Message, data: InfoResult[]): MessageEmbed => {
    return new MessageEmbed()
    .setColor(0xda8e35)
    .setTitle('Info Command Help')
    .setDescription('This command will return an embed or message based on a preset help topic.\nUse `!nm i {topic}` to invoke this command.')
    .addField('Available Topics (case insensitive)', data.map(i => `${i.title} [${i.name}]`).join("\n").substr(0, 1024))
    .setFooter({text:`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL:client.user?.avatarURL() || ''});
}

const notFound = (client: Client, message: Message, query: string): MessageEmbed => {
    return new MessageEmbed()
    .setColor(0xda8e35)
    .setTitle('Info Not Found')
    .setDescription(`There are no stored infos matching your query "${query}".`)
    .setFooter({text:`Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL:client.user?.avatarURL() || ''});
}

export { run, help };