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
        await botuser.NexusMods.API.v1.Games();
        await botuser.NexusMods.API.v1.Game('skyrim');
        await botuser.NexusMods.API.v1.ModQuickSearch('skyui', true);
        await botuser.NexusMods.API.v1.UpdatedMods('skyrim');
        await botuser.NexusMods.API.v1.Mod('skyrim', 3863);
        await botuser.NexusMods.API.v1.ModFiles('skyrim', 3863);
        await botuser.NexusMods.API.v1.ModChangelogs('skyrim', 3863);
        logMessage('v1 API test complete');
        await botuser.NexusMods.API.v2.IsModAuthor(1);
        await botuser.NexusMods.API.v2.Games();
        await botuser.NexusMods.API.v2.Mod({ gameDomain: 'skyrim', modId: 3863 });
        await botuser.NexusMods.API.v2.ModsByModId([{ gameDomain: 'skyrim', modId: 3863 }]);
        await botuser.NexusMods.API.v2.MyCollections();
        await botuser.NexusMods.API.v2.Collections({}, 'endorsements_count');
        await botuser.NexusMods.API.v2.Collection('pkcov7', 'skyrimspecialedition', true);
        await botuser.NexusMods.API.v2.CollectionsByUser(51448566);
        await botuser.NexusMods.API.v2.FindUser('Janquel');
        await botuser.NexusMods.API.v2.FindUser(51448566)
        logMessage('v2 API test complete');
        return interaction.editReply(`Success`);
    }
    catch(err) {
        return interaction.editReply({ content: 'Error! '+err });
    }
}

export { discordInteraction }