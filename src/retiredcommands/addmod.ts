import { Client, Message, GuildChannel, TextChannel, PartialDMChannel, DMChannel, MessageEmbed, EmbedFieldData, ThreadChannel } from "discord.js";
import { BotServer } from "../types/servers";
import { NexusUser, NexusLinkedMod } from "../types/users";
import { getUserByDiscordId, getModsbyUser, createMod, updateAllRoles } from "../api/bot-db";
import { CommandHelp, ModDownloadInfo, NexusSearchModResult } from "../types/util";
import { IGameInfo, IModInfo } from "@nexusmods/nexus-api";
import { games, modInfo, getDownloads, quicksearch } from "../api/nexus-discord";
import { discontinuedEmbed } from '../api/util';

const modUrlExp = /nexusmods.com\/([a-zA-Z0-9]+)\/mods\/([0-9]+)/i;

const help: CommandHelp = {
    name: "addmod",
    description: "Allows authors to show mods on their profile cards in Discord.\nCan also be used to gain 'Mod Author' status on servers using the bot.",
    usage: "[mod title or link, comma separated]",
    moderatorOnly: false,
    adminOnly: false,
    officialOnly: false 
}

async function run(client: Client, message: Message, args: string[], server: BotServer) {
    // Get reply channel
    const replyChannel: (GuildChannel | PartialDMChannel | DMChannel | ThreadChannel | undefined | null) = server && server.channel_bot ? message.guild?.channels.resolve(server.channel_bot) : message.channel;
    const rc: TextChannel = (replyChannel as TextChannel);
    const prefix = rc === message.channel ? '' : `${message.author.toString()} - `
    const discordId: string = message.author.id;

    return message.reply({ embeds: [discontinuedEmbed('/addmod')] }).catch(undefined);

    // // Get User data
    // const userData: NexusUser | undefined = await getUserByDiscordId(discordId).catch(() => undefined);
    // if (!userData) return rc.send(`${prefix}You do not have a Nexus Mods account linked to your Discord profile.`).catch(() => undefined);
    // let mods: NexusLinkedMod[] = await getModsbyUser(userData.id).catch(() => []);

    // // No arguments 
    // if (!args.length) return rc.send(`${prefix}To link a mod to your Discord account type \`!nexus addmod <mod title/url>\`. You can add several mods at once by using a comma to separate your queries.`).catch(() => undefined);

    // // Get started by sending a working message and processing the query.
    // let embed: MessageEmbed = startUpEmbed(client, message, userData);
    // const msg: Message|undefined = await rc.send({ content: message.channel === rc ? undefined : message.author.toString(), embeds: [embed] }).catch(() => undefined);
    // if (!msg) return console.log(`${new Date().toLocaleString()} - Could not post addmod message, aborting.`, userData.name, message.guild?.name);

    // let queries: string[] = args.join(' ').split(',').slice(0, 25);
    // const urlQueries: string[] = queries.filter(q => q.trim().match(modUrlExp));
    // const strQueries: string[] = queries.filter(q => !!q && !urlQueries.includes(q));

    // console.log(`${new Date().toLocaleString()} - ${queries.length} addmod queries sent by ${userData.name} (${message.author.tag})`, urlQueries, strQueries);

    // embed.setTitle(`Checking for ${queries.length} mod(s)...`);
    // await msg.edit({ embeds: [embed] }).catch(() => undefined);

    // try {
    //     const allGames: IGameInfo[] = await games(userData);

    //     const urlResults: EmbedFieldData[] = await Promise.all(
    //         urlQueries.map((url: string) => urlCheck(url, mods, allGames, userData))
    //     );
    //     const strResults: EmbedFieldData[] = await Promise.all(
    //         strQueries.map((query: string) => stringCheck(query, mods, allGames, userData))
    //     );

    //     const allResults: EmbedFieldData[] = urlResults.concat(strResults).filter(r => r !== undefined);

    //     embed.setTitle('Adding mods complete')
    //     .addFields(allResults);

    //     await updateAllRoles(client, userData, message.author, false);

    //     return msg.edit({ embeds : [embed] }).catch(() => undefined);

    // }
    // catch (err) {
    //     embed.setColor(0xff000);
    //     embed.setTitle('An error occurred adding this mod');
    //     embed.setDescription(`Error details:\n\'\'\'${JSON.stringify(err, null, 2)}\'\'\'\nPlease try again later. If this problem persists please report it to Nexus Mods.`);
    //     return msg.edit({ embeds : [embed] }).catch(() => undefined);
    // }

}

async function urlCheck(link: string, mods: NexusLinkedMod[], games: IGameInfo[], user: NexusUser): Promise<EmbedFieldData> {
    let modName: string|undefined = undefined;

    try {
        const matches: RegExpMatchArray|null = link.match(modUrlExp);
        if (!matches) throw new Error('Invalid URL');
        const domain: string = matches[1];
        const game: IGameInfo|undefined = games.find(g => g.domain_name === domain);
        if (!game) throw new Error(`${domain} does not appear to be a valid game.`);
        const modId: number = parseInt(matches[2]);
        if (modId === NaN) throw new Error('Invalid Mod ID');
        const url = `https://nexusmods.com/${domain}/mods/${modId}`;
        // Check if the mod is already attached to their account.
        if (mods.find(m => m.domain === domain && m.mod_id === modId)) {
            const matchedMod = mods.find(m => m.domain === domain && m.mod_id === modId);
            modName = matchedMod?.name;
            throw new Error(`This mod is already linked to your account. Use \`!nm refresh\` to update the data.`);
        }

        const modData: IModInfo|undefined = await modInfo(user, domain, modId).catch(() => undefined);
        if (!modData) throw new Error(`Mod ID #${modId} not found for ${game.name}`);
        
        modName = modData.name || `${domain}/mods/${modId}`;

        if (modData.status !== "published") {
            switch(modData.status) {
                case('not_published'): throw new Error(`[Mod #${modId}](${url}) for ${game.name} is not published. Please publish it before adding it to your account.`);
                case('hidden'): throw new Error(`[Mod #${modId}](${url}) for ${game.name} is hidden. Please unhide it before adding it to your account.`);
                case('under_moderation'): throw new Error(`[Mod #${modId}](${url}) for ${game.name} has been locked by a moderator. Please contact the Nexus Mods team for further information.`);
                case('wastebinned' || 'removed'): throw new Error(`[Mod #${modId}](${url}) for ${game.name} has been deleted and cannot be added to your account.`);
                default: throw new Error(`[Mod #${modId}](${url}) for ${game.name} has a status of ${modData.status} and cannot be added to your account.`)
            }
        }

        if (modData.user.member_id !== user.id) throw new Error (`[${modData.name || `Mod #${modId}`}](https://www.nexusmods.com/${game.domain_name}/mods/${modData.mod_id}) was uploaded by [${modData.user.name}](https://www.nexusmods.com/users/${modData.user.member_id}) so it cannot be added to your account.`);

        if (!modData.name) throw new Error(`[Mod #${modId}](${url}) for ${game.name} could not be added as it doesn't seem to have a title. Please try again in a few minutes.`);
        
        const downloadData: ModDownloadInfo = 
            (await getDownloads(user, domain, game.id, modId).catch(() => { return {unique_downloads: 0, total_downloads: 0, id: modId }})) as ModDownloadInfo;

        const newMod: NexusLinkedMod = {
            name: modData.name,
            domain,
            mod_id: modId,
            game: game.name,
            owner: user.id,
            unique_downloads: downloadData.unique_downloads,
            total_downloads: downloadData.total_downloads,
            path: `${domain}/mods/${modId}`
        }

        mods.push(newMod);

        await createMod(newMod);
        return { name: modName, value: `- [${newMod.name}](${url}) added.` };
    }
    catch(err: any) {
        return { name: modName || link, value: err.message };
    }

}

async function stringCheck (query: string, mods: NexusLinkedMod[], games: IGameInfo[], user: NexusUser): Promise<EmbedFieldData> {

    try {
        const search: NexusSearchModResult[] = (await quicksearch(query, true).catch(() => { return { results: [] } } )).results;
        const filteredResult: NexusSearchModResult[] = 
            search.filter(mod => mod.user_id === user.id && !mods.find(m => m.mod_id === mod.mod_id && m.domain === mod.game_name));

        if (!filteredResult.length) throw new Error(`No matching mods created by ${user.name}`);


        const messages: string[] = await Promise.all(filteredResult.map(
            async (res: NexusSearchModResult) => {
                const game = games.find(g => g.id === res.game_id);
                const downloadData: ModDownloadInfo = 
                    (await getDownloads(user, res.game_name, res.game_id, res.mod_id).catch(() => { return {unique_downloads: 0, total_downloads: 0, id: res.mod_id }})) as ModDownloadInfo;
                const newMod: NexusLinkedMod = {
                    name: res.name,
                    domain: res.game_name,
                    mod_id: res.mod_id,
                    game: game?.name || '',
                    owner: user.id,
                    unique_downloads: downloadData.unique_downloads,
                    total_downloads: downloadData.total_downloads,
                    path: `${res.game_name}/mods/${res.mod_id}` 
                }

                mods.push(newMod);

                await createMod(newMod);
                return `- [${newMod.name}](https://nexusmods.com/${newMod.path}) added.`
            }
        ));

        return { name: query, value: messages.join('\n').substr(0, 1024) };
    }
    catch(err: any) {
        return { name: query, value: err.message };
    }

}

const startUpEmbed = (client: Client, message: Message, user: NexusUser): MessageEmbed => {
    return new MessageEmbed()
    .setTitle('Preparing to add mods...')
    .setThumbnail(user.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setColor(0xda8e35)
    .setFooter({ text: `Nexus Mods API link - ${message.author.tag}: !nm addmod`, iconURL: client.user?.avatarURL() || ''});
}

export { run, help };