import { CommandInteraction, EmbedFieldData, Client, MessageEmbed } from "discord.js";
import { DiscordInteraction, ModDownloadInfo, NexusSearchModResult } from "../types/util";
import { NexusUser, NexusLinkedMod } from "../types/users";
import { getUserByDiscordId, getModsbyUser, createMod, updateAllRoles } from '../api/bot-db';
import { logMessage } from "../api/util";
import { games, getDownloads, modInfo, quicksearch } from "../api/nexus-discord";
import { IGameInfo, IModInfo } from "@nexusmods/nexus-api";

const modUrlExp = /nexusmods.com\/([a-zA-Z0-9]+)\/mods\/([0-9]+)/i;

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'addmod',
        description: 'Associate a mod with your Discord account.',
        options: [{
            name: 'searchterm',
            type: 'STRING',
            description: 'Add links or search terms for mods to add, comma separated.',
            required: true,
        }]
    },
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<any> {
    logMessage('AddMod interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: interaction.channel?.toString() });
    await interaction.deferReply({ ephemeral: true });

    // Get existing user data and mods.
    const discordId: string = interaction.user.id;
    const user: NexusUser = await getUserByDiscordId(discordId);
    if (!user) return interaction.editReply({ content: 'You do not have a Nexus Mods account linked to your profile. Use /link to get stared.' });
    const mods = await getModsbyUser(user.id).catch(() => []);

    // Get arguments
    const args: string[] = interaction.options.getString('searchterm')?.split(',').slice(0, 24).map(t => t.trim()) || [];
    const urlQueries: string[] = args.filter(q => q.trim().match(modUrlExp));
    const strQueries: string[] = args.filter(q => !!q && !urlQueries.includes(q));

    logMessage('Looking up mods', { name: user.name, discord: interaction.user.tag, urlQueries, strQueries });

    const searchingEmbed: MessageEmbed = new MessageEmbed()
    .setTitle(`Checking ${args.length} search terms(s)...`)
    .setDescription(args.join('\n'))
    .setThumbnail(user.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || ''});

    await interaction.editReply({ embeds: [searchingEmbed] });

    try {
        const gameList: IGameInfo[] = await games(user);

        const urlResults: EmbedFieldData[] = await Promise.all(
            urlQueries.map((url: string) => urlCheck(url, mods, gameList, user))
        );
        const strResults: EmbedFieldData[] = await Promise.all(
            strQueries.map((query: string) => stringCheck(query, mods, gameList, user))
        );

        const allResults: EmbedFieldData[] = urlResults.concat(strResults).filter(r => r !== undefined);

        searchingEmbed.setTitle('Adding mods complete')
        .setDescription('')
        .addFields(allResults);

        await updateAllRoles(client, user, interaction.user, false);

        return interaction.editReply({ embeds: [ searchingEmbed ] });

    }
    catch(err) {
        searchingEmbed.setColor(0xff000);
        searchingEmbed.setTitle('An error occurred adding mods');
        searchingEmbed.setDescription(`Error details:\n\'\'\'${JSON.stringify(err, null, 2)}\'\'\'\nPlease try again later. If this problem persists please report it to Nexus Mods.`);
        return interaction.editReply({ embeds : [searchingEmbed] }).catch(() => undefined);
    }

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
    catch(err) {
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
    catch(err) {
        return { name: query, value: err.message };
    }

}

export { discordInteraction };