import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, CommandInteraction, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getUserByDiscordId } from '../api/bot-db';
import { KnownDiscordServers, Logger } from "../api/util";
import { DiscordBotUser } from "../api/DiscordBotUser";
import { customEmojis } from "../types/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Testing Command.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        KnownDiscordServers.BotDemo,
        KnownDiscordServers.Moderator,

    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const discordId = interaction.user.id;
    const botuser: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
    if (!botuser) return interaction.editReply({ content: 'Error! No linked user!' });
    try {
        await botuser.NexusMods.Auth();
        logger.info('Nexus Mods Auth verfied.');

        const v2test = {
            IsModAuthor: (await botuser.NexusMods.API.v2.IsModAuthor(1)) === true,
            Mod: (await botuser.NexusMods.API.v2.Mod('skyrim', 3863))[0].name === 'SkyUI',
            Mods: (await botuser.NexusMods.API.v2.Mods({ name: { value: 'skyui', op: 'WILDCARD' } })).totalCount > 0,
            UpdatedMods: (await botuser.NexusMods.API.v2.UpdatedMods(new Date(0), true)).totalCount > 0,
            ModsByModId: (await botuser.NexusMods.API.v2.ModsByModId([{ gameDomain: 'skyrim', modId: 3863 }])).length > 0,
            MyCollections: (await botuser.NexusMods.API.v2.MyCollections()).length > 0,
            Collections: (await botuser.NexusMods.API.v2.Collections({}, { endorsements: { direction: 'DESC' }})).nodesCount > 0,
            Collection: (await botuser.NexusMods.API.v2.Collection('pkcov7', 'skyrimspecialedition', true))?.slug === 'pkcov7',
            CollectionsByUser: (await botuser.NexusMods.API.v2.CollectionsByUser(31179975)).nodesCount > 0,
            FindUserName: (await botuser.NexusMods.API.v2.FindUser('Janquel'))?.memberId === 51448566,
            CollectionDownloadTotals: (await botuser.NexusMods.API.v2.CollectionDownloadTotals(31179975))?.totalDownloads > 0,
            FindUserID: (await botuser.NexusMods.API.v2.FindUser(51448566))?.name === 'Janquel',
            LatestMods: (await botuser.NexusMods.API.v2.LatestMods(new Date(1))).totalCount > 0
        }

        const otherTest = {
            Games: (await botuser.NexusMods.API.Other.Games()).length > 1,
            WebsiteStatus: !!(await botuser.NexusMods.API.Other.WebsiteStatus()),
        }
        
        logger.info('API tests complete', { v2test, otherTest });

        const format = (input: {[key: string]: boolean}): string => 
            Object.entries(input).reduce((prev: string, cur: [string, boolean]) => {
                return prev + `${cur[0]}: ${cur[1] ? '✅' : '⚠️' }\n`
            }, '');

        const formatted = `## V2 API Tests\n${format(v2test)}\n## Other\n${format(otherTest)}`;

        const embed = await botuser.ProfileEmbed(client);

        const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
            .setLabel('Collections')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(customEmojis.collection)
            .setCustomId('collections'),
            new ButtonBuilder()
            .setLabel('Mods')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(customEmojis.mod)
            .setCustomId('mods')
        );

        return interaction.editReply({ content: formatted, embeds: [embed], components: [button] });
    }
    catch(err) {
        return interaction.editReply({ content: 'Error! '+err });
    }
}

export { discordInteraction }