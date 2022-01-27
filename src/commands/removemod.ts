import { Client, Message, GuildChannel, PartialDMChannel,DMChannel, TextChannel, EmbedFieldData, MessageEmbed, ThreadChannel } from "discord.js";
import { BotServer } from "../types/servers";
import { CommandHelp } from "../types/util";
import { NexusUser, NexusLinkedMod } from "../types/users";
import { getModsbyUser, getUserByDiscordId, deleteMod, updateAllRoles } from "../api/bot-db";

const modUrlExp = /nexusmods.com\/([a-zA-Z0-9]+)\/mods\/([0-9]+)/i;

const help: CommandHelp = {
    name: "removemod",
    description: "Allows authors to remove mods on their profile cards in Discord.",
    usage: "[full mod title or url]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

async function run(client: Client, message: Message, args: string[], server: BotServer) {
    // Get reply channel
    const replyChannel: (GuildChannel| PartialDMChannel | DMChannel | ThreadChannel | undefined | null) = server && server.channel_bot ? message.guild?.channels.resolve(server.channel_bot) : message.channel;
    const rc: TextChannel = (replyChannel as TextChannel);
    const prefix = rc === message.channel ? '' : `${message.author.toString()} - `
    const discordId: string = message.author.id;

    // Get User data
    const userData: NexusUser | undefined = await getUserByDiscordId(discordId).catch(() => undefined);
    if (!userData) return rc.send(`${prefix}You do not have a Nexus Mods account linked to your Discord profile.`).catch(() => undefined);
    let mods: NexusLinkedMod[] = await getModsbyUser(userData.id).catch(() => []);

    // No args
    if (!args.length) return rc.send(`${prefix}To remove a mod to from Discord account type \`!nexus removemod <mod title/url>\`. You can add several mods at once by using a comma to separate your queries. Titles must be exact.`).catch(() => undefined);

    // Send feedback to the user
    const embed: MessageEmbed = startUpEmbed(client, message, userData)
    const reply: Message|undefined = await rc.send({ embeds: [embed] }).catch(() => undefined);

    // Break down the query into URLs and strings
    const fullQuery: string[] = args.join(' ').split(',').map(q => q.trim());
    const urlQueries: string[] = fullQuery.filter(q => q.match(modUrlExp));
    const strQueries: string[] = fullQuery.filter(q => !urlQueries.includes(q));
    
    const urlRemovals: (NexusLinkedMod|undefined)[] = await Promise.all(urlQueries.map(async (q) => {
        const result: RegExpMatchArray|null = q.match(modUrlExp);
        if (!result) return undefined;
        const domain = result[1];
        const modId = parseInt(result[2]);
        if (modId === NaN) return undefined;
        const modToRemove: NexusLinkedMod|undefined = mods.find(mod => mod.domain === domain && mod.mod_id === modId);
        if (!modToRemove) return undefined;
        await deleteMod(modToRemove);
        return modToRemove;
    }));

    const strRemovals: (NexusLinkedMod|undefined)[] = await Promise.all(strQueries.map(async (q) => {
        const modToRemove = mods.find(mod => mod.name.toLowerCase() === q.toLowerCase());
        if (!modToRemove) return undefined;
        await deleteMod(modToRemove);
        return modToRemove;
    }));

    const allRemovals: string[] = 
        urlRemovals.concat(strRemovals).filter(r => r !== undefined).map(remove => {
            return `[${remove?.name}](https://nexusmods.com/${remove?.path})`;
        });
    
    console.log(`${new Date().toLocaleString()} - ${allRemovals.length} removemod queries sent by ${userData.name} (${message.author.tag})`);
    
    embed.setTitle(`Deleted ${allRemovals.length} mod(s)`)
    .setDescription(allRemovals.length ? allRemovals.join('\n') : '*none*');

    await updateAllRoles(client, userData, message.author, false);

    return reply?.edit({ embeds: [embed] }).catch(() => undefined);
}

const startUpEmbed = (client: Client, message: Message, user: NexusUser): MessageEmbed => {
    return new MessageEmbed()
    .setTitle('Preparing to remove mods...')
    .setThumbnail(user.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setColor(0xda8e35)
    .setFooter({ text: `Nexus Mods API link - ${message.author.tag}: ${message.cleanContent}`, iconURL: client.user?.avatarURL() || '' })
}



export { run, help };