import { ChatInputCommandInteraction, CommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getUserByDiscordId } from '../api/bot-db';
import { logMessage } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Testing GQL.')
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
    const user = await getUserByDiscordId(discordId);
    const botuser = new DiscordBotUser(user);
    try {
        await botuser.NexusMods.Auth();
        logMessage('Nexus Mods Auth verfied.');
        const gamesv1 = await botuser.NexusMods.API.v1.Games();
        logMessage('V1 Games found', gamesv1.length);
        const gamev1 = await botuser.NexusMods.API.v1.Game('skyrim');
        logMessage('V1 Game', gamev1.name);
        const modSearchv1 = await botuser.NexusMods.API.v1.ModQuickSearch('skyui', true);
        logMessage('V1 Mod Search', modSearchv1.results.length);
        const newModsv1 = await botuser.NexusMods.API.v1.UpdatedMods('skyrim');
        logMessage('V1 Updated Mods', newModsv1.length);
        const modv1 = await botuser.NexusMods.API.v1.Mod('skyrim', 3863);
        logMessage('V1 Mod', modv1.name);
        const filesv1 = await botuser.NexusMods.API.v1.ModFiles('skyrim', 3863);
        logMessage('V1 Files', filesv1.files[0]);
        const changelogsv1 = await botuser.NexusMods.API.v1.ModChangelogs('skyrim', 3863);
        logMessage('V1 Changelogs', Object.keys(changelogsv1));
        logMessage('v1 API test complete');

        const v2author = await botuser.NexusMods.API.v2.IsModAuthor(1);
        logMessage('V2 Author', v2author);
        const v2games = await botuser.NexusMods.API.v2.Games();
        logMessage('V2 Games', v2games.length);
        const v2mod = await botuser.NexusMods.API.v2.Mod({ gameDomain: 'skyrim', modId: 3863 });
        logMessage('V2 Mod', v2mod[0].name);
        const v2modidsearch = await botuser.NexusMods.API.v2.ModsByModId([{ gameDomain: 'skyrim', modId: 3863 }]);
        logMessage('V2 Mod ID search', v2modidsearch.length);
        const v2mycollections = await botuser.NexusMods.API.v2.MyCollections();
        logMessage('V2 My Collections', v2mycollections.length);
        const v2collections = await botuser.NexusMods.API.v2.Collections({}, 'endorsements_count');
        logMessage('V2 Collections', v2collections.nodesCount);
        const v2collection = await botuser.NexusMods.API.v2.Collection('pkcov7', 'skyrimspecialedition', true);
        logMessage('V2 Collection', v2collection?.name);
        const v2UserCollections = await botuser.NexusMods.API.v2.CollectionsByUser(51448566);
        logMessage('V2 User Collections', v2UserCollections.nodesCount);
        const v2userbyname = await botuser.NexusMods.API.v2.FindUser('Janquel');
        logMessage('V2 User by name', v2userbyname?.memberId);
        const v2userbyid = await botuser.NexusMods.API.v2.FindUser(51448566)
        logMessage('V2 User by name', v2userbyid?.name);
        logMessage('v2 API test complete');
        return interaction.editReply(`Success`);
    }
    catch(err) {
        return interaction.editReply({ content: 'Error! '+err });
    }
}

export { discordInteraction }