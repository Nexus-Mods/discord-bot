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
        const v1test = {
            Games: (await botuser.NexusMods.API.v1.Games()).length > 2000,
            Game: (await botuser.NexusMods.API.v1.Game('skyrim')).name === 'Skyrim',
            ModQuickSearch: (await botuser.NexusMods.API.v1.ModQuickSearch('skyui', true)).results.length > 0,
            UpdatedMods: (await botuser.NexusMods.API.v1.UpdatedMods('skyrimspecialedition')).length > 0,
            Mod: (await botuser.NexusMods.API.v1.Mod('skyrim', 3863)).name === 'SkyUI',
            ModFiles: (await botuser.NexusMods.API.v1.ModFiles('skyrim', 3863)).files[0].file_name === 'SkyUI_1_0-3863.7z',
            ModChangelogs: Object.keys(await botuser.NexusMods.API.v1.ModChangelogs('skyrim', 3863)).includes('5.1')
        }

        const v2test = {
            IsModAuthor: (await botuser.NexusMods.API.v2.IsModAuthor(1)) === true,
            Games: (await botuser.NexusMods.API.v2.Games()).length > 2000,
            Mod: (await botuser.NexusMods.API.v2.Mod({ gameDomain: 'skyrim', modId: 3863 }))[0].name === 'SkyUI',
            ModsByModId: (await botuser.NexusMods.API.v2.ModsByModId([{ gameDomain: 'skyrim', modId: 3863 }])).length > 0,
            MyCollections: (await botuser.NexusMods.API.v2.MyCollections()).length > 0,
            Collections: (await botuser.NexusMods.API.v2.Collections({}, 'endorsements_count')).nodesCount > 0,
            Collection: (await botuser.NexusMods.API.v2.Collection('pkcov7', 'skyrimspecialedition', true))?.slug === 'pkcov7',
            CollectionsByUser: (await botuser.NexusMods.API.v2.CollectionsByUser(51448566)).nodesCount > 0,
            FindUserName: (await botuser.NexusMods.API.v2.FindUser('Janquel'))?.memberId === 51448566,
            FindUserID: (await botuser.NexusMods.API.v2.FindUser(51448566))?.name === 'Janquel'
        }
        
        logMessage('API tests complete', { v1test, v2test });

        const format = (input: {[key: string]: boolean}): string => 
            Object.entries(input).reduce((prev: string, cur: [string, boolean]) => {
                return prev + `${cur[0]}: ${cur[1] ? '✅' : '⚠️' }\n`
            }, '');

        const formatted = `**V1 Tests**\n${format(v1test)}\n\n**V2 Tests**\n${format(v2test)}`;

        return interaction.editReply(formatted);
    }
    catch(err) {
        return interaction.editReply({ content: 'Error! '+err });
    }
}

export { discordInteraction }