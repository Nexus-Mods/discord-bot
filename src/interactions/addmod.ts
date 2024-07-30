import { Client, EmbedBuilder, APIEmbedField, SlashCommandBuilder, ChatInputCommandInteraction, CommandInteraction } from "discord.js";
import { ModDownloadInfo } from "../types/util";
import { DiscordInteraction } from '../types/DiscordTypes';
import { NexusLinkedMod } from "../types/users";
import { getUserByDiscordId, getModsbyUser, createMod, updateAllRoles } from '../api/bot-db';
import { logMessage } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";
import { IMod } from "../api/queries/v2";
import { IGameStatic } from "../api/queries/other";

const modUrlExp = /nexusmods.com\/([a-zA-Z0-9]+)\/mods\/([0-9]+)/i;

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('addmod')
    .setDescription('Associated a mod with your Discord account.')
    .addStringOption(option => 
      option.setName('searchterm')  
      .setDescription('Add links or search terms for mods to add, comma separated.')
      .setRequired(true)
    )
    .setDMPermission(true) as SlashCommandBuilder,
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

interface SearchError extends APIEmbedField {
    error: boolean;
}

async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // logMessage('AddMod interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name });
    await interaction.deferReply({ ephemeral: true }).catch(err => { throw err });

    // Get existing user data and mods.
    const discordId: string = interaction.user.id;
    const user: DiscordBotUser | undefined = await getUserByDiscordId(discordId);
    if (!user) return interaction.editReply({ content: 'You do not have a Nexus Mods account linked to your profile. Use /link to get stared.' });
    try { 
        await user.NexusMods.Auth()
    }
    catch(err) {
        return interaction.editReply({ content: 'There was a problem authorising your Nexus Mods account. Use /link to refresh your tokens.' });
    }
    const mods = await getModsbyUser(user.NexusModsId).catch(() => []);

    // Get arguments
    const args: string[] = interaction.options.getString('searchterm')?.split(',').slice(0, 24).map(t => t.trim()) || [];
    const urlQueries: string[] = args.filter(q => q.trim().match(modUrlExp));
    const strQueries: string[] = args.filter(q => !!q && !urlQueries.includes(q));

    logMessage('Looking up mods', { name: user.NexusModsUsername, discord: interaction.user.tag, urlQueries, strQueries });

    const searchingEmbed: EmbedBuilder = new EmbedBuilder()
    .setTitle(`Checking ${args.length} search terms(s)...`)
    .setDescription(args.join('\n'))
    .setThumbnail(user.NexusModsAvatar || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || ''});

    await interaction.editReply({ embeds: [searchingEmbed] });

    try {
        const gameList: IGameStatic[] = await user.NexusMods.API.Other.Games();

        const urlResults: (APIEmbedField[] | SearchError[]) = await Promise.all(
            urlQueries.map((url: string) => urlCheck(url, mods, gameList, user))
        );
        const strResults: (APIEmbedField[] | SearchError[]) = await Promise.all(
            strQueries.map((query: string) => stringCheck(query, mods, gameList, user))
        );

        const allResults: (APIEmbedField | SearchError)[] = urlResults.concat(strResults).filter(r => r !== undefined);
        const addedMods: APIEmbedField[] = allResults.filter(r => (r as APIEmbedField) && !(r as SearchError).error);
        logMessage('Added mods', { user: interaction.user.tag, mods: addedMods.length });

        searchingEmbed.setTitle('Adding mods complete')
        .setDescription(null)
        .addFields(allResults.slice(0, 24));

        await interaction.editReply({ embeds: [ searchingEmbed ] });
        // if (addedMods.length) await updateAllRoles(client, user, interaction.user, false);

        return;

    }
    catch(err) {
        searchingEmbed.setColor(0xff000);
        searchingEmbed.setTitle('An error occurred adding mods');
        searchingEmbed.setDescription(`Error details:\n\'\'\'${JSON.stringify(err, null, 2)}\'\'\'\nPlease try again later. If this problem persists please report it to Nexus Mods.`);
        return interaction.editReply({ embeds : [searchingEmbed] }).catch(() => undefined);
    }

}

async function urlCheck(link: string, mods: NexusLinkedMod[], games: IGameStatic[], user: DiscordBotUser): Promise<APIEmbedField | SearchError> {
    let modName: string|undefined = undefined;

    try {
        const matches: RegExpMatchArray|null = link.match(modUrlExp);
        if (!matches) throw new Error('Invalid URL');
        const domain: string = matches[1];
        const game: IGameStatic|undefined = games.find(g => g.domain_name === domain);
        if (!game) throw new Error(`${domain} does not appear to be a valid game.`);
        const modId: number = parseInt(matches[2]);
        if (Number.isNaN(modId)) throw new Error('Invalid Mod ID');
        const url = `https://nexusmods.com/${domain}/mods/${modId}`;
        // Check if the mod is already attached to their account.
        if (mods.find(m => m.domain === domain && m.mod_id === modId)) {
            const matchedMod = mods.find(m => m.domain === domain && m.mod_id === modId);
            modName = matchedMod?.name;
            throw new Error(`This mod is already linked to your account. Use \`/refresh\` to update the data.`);
        }

        const modData: IMod|undefined = (await user.NexusMods.API.v2.Mod(domain, modId).catch(() => []))[0];
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

        if (modData.uploader.memberId != user.NexusModsId) throw new Error (`[${modData.name || `Mod #${modId}`}](https://www.nexusmods.com/${game.domain_name}/mods/${modData.modId}) was uploaded by [${modData.uploader.name}](https://www.nexusmods.com/users/${modData.uploader.memberId}) so it cannot be added to your account.`);

        if (!modData.name) throw new Error(`[Mod #${modId}](${url}) for ${game.name} could not be added as it doesn't seem to have a title. Please try again in a few minutes.`);
        
        const downloadData: ModDownloadInfo = await user.NexusMods.API.Other.ModDownloads(game.id, modData.modId)
            .catch(() => ({ unique_downloads: 0, total_downloads: 0, id: modId })) as ModDownloadInfo;

        const newMod: NexusLinkedMod = {
            name: modData.name,
            domain,
            mod_id: modId,
            game: game.name,
            owner: user.NexusModsId,
            unique_downloads: downloadData.unique_downloads,
            total_downloads: downloadData.total_downloads,
            path: `${domain}/mods/${modId}`
        }

        mods.push(newMod);

        await createMod(newMod);
        return { name: modName, value: `- [${newMod.name}](${url}) added.` };
    }
    catch(err) {
        logMessage('Error creating mod entry', {err, modName, link}, true);
        return { name: modName || link, value: `Error: ${(err as Error).message}`, error: true };
    }

}

async function stringCheck (query: string, mods: NexusLinkedMod[], games: IGameStatic[], user: DiscordBotUser): Promise<APIEmbedField | SearchError> {

    try {
        const search: IMod[] = (await user.NexusMods.API.v2.Mods(query, true).catch(() => { return { nodes: [] } } )).nodes;
        const filteredResult: IMod[] = 
            search.filter(mod => mod.uploader.memberId == user.NexusModsId && !mods.find(m => m.mod_id === mod.modId && m.domain === mod.game.domainName));

        if (!filteredResult.length) throw new Error(`No matching mods created by ${user.NexusModsUsername}`);


        const messages: string[] = await Promise.all(filteredResult.map(
            async (res: IMod) => {
                const game = games.find(g => g.id === res.game.id);
                const modData = (await user.NexusMods.API.v2.Mod(game?.domain_name!, res.modId))?.[0];
                const downloadData: ModDownloadInfo = await user.NexusMods.API.Other.ModDownloads(modData.game.id, modData.modId) as ModDownloadInfo ||
                { unique_downloads: 0, total_downloads: 0, id: res.modId };
                const newMod: NexusLinkedMod = {
                    name: res.name,
                    domain: res.game.domainName,
                    mod_id: res.modId,
                    game: game?.name || '',
                    owner: user.NexusModsId,
                    unique_downloads: downloadData.unique_downloads,
                    total_downloads: downloadData.total_downloads,
                    path: `${res.game.domainName}/mods/${res.modId}` 
                }

                mods.push(newMod);

                await createMod(newMod);
                return `- [${newMod.name}](https://nexusmods.com/${newMod.path}) added.`
            }
        ));

        return { name: query, value: messages.join('\n').substring(0, 1024) };
    }
    catch(err) {
        return { name: query, value: `Error: ${(err as Error).message}`, error: true };
    }

}

export { discordInteraction };