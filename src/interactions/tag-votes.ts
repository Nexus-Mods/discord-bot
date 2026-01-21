import { AutocompleteInteraction, ChatInputCommandInteraction, CommandInteraction, hideLinkEmbed, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { autoCompleteGameID, autoCompleteModSearchIdOnly, autoCompleteUserSearch, KnownDiscordServers, Logger } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('tag-votes')
    .setDescription('See users tag votes')
    .addNumberOption(option =>
        option.setName('gameid')
        .setDescription('The numerical ID for a game.')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addNumberOption(option =>
        option.setName('modid')
        .setDescription('The numerical ID for a mod, from the end of the URL.')
        .setAutocomplete(true)
    )
    .addNumberOption(option =>
        option.setName('userid')
        .setDescription('The numerical ID for a user.')
        .setAutocomplete(true)
    )
    .addNumberOption(option =>
        option.setName('tagid')
        .setDescription('The numerical ID for a tag. This is available in the admin area.')
    )
    .addNumberOption(option =>
        option.setName('ratingtype')
        .setDescription('Filter by upvote (+1) or downvote (-1).')
        .setChoices([
            {
                value: 1,
                name: 'Upvote (+1)'
            },
            {
                value: -1,
                name: 'Downvote (-1)'
            }
        ])
    )
    .addNumberOption(option =>
        option.setName('limit')
        .setDescription('Limit the number of returned results (default 20)')
        .setMaxValue(50)
        .setMinValue(1)
    )
    .addNumberOption(option =>
        option.setName('offset')
        .setDescription('To paginate through results, use an offset value.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    public: false,
    guilds: [
        KnownDiscordServers.BotDemo,
        KnownDiscordServers.Moderator,

    ],
    action,
    autocomplete
}

interface IClickHouseResponse {
    meta: { name: string, type: string }[];
    data: ITagDetail[];
}

interface ITagDetail {
    "Tag Name": string,
    "Voted by": string,
    "User ID": number,
    "Mod Name": string,
    "Game": string,
    "Game ID": number,
    "Mod ID": number,
    "Tag ID": number,
    "Rating Type": "Upvote (+1)" | "Downvote (-1)"
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply();

    const gameId: number = interaction.options.getNumber('gameid', true);
    const modId: number | null = interaction.options.getNumber('modid');
    const tagId: number | null = interaction.options.getNumber('tagid');
    const userId: number | null = interaction.options.getNumber('userid');
    const ratingType: number | null = interaction.options.getNumber('ratingtype');
    const limit: number | null = interaction.options.getNumber('limit') || 20;
    const offset: number = interaction.options.getNumber('offset') || 0;

    const params = new URLSearchParams({
        format: 'JSON',
        param_GameID: String(gameId),
        param_ModID: modId ? String(modId): '',
        param_TagID: tagId ? String(tagId): '',
        param_UserID: userId ? String(userId): '',
        param_Rating: ratingType ? String(ratingType) : '',
        param_LimitCount: String(limit),
        param_OffsetCount: String(offset)
    });

    const openApiKeyId = process.env.CLICKHOUSE_KEYID;
    const openApiKeySecret = process.env.CLICKHOUSE_KEYSECRET;

    if (!openApiKeyId || !openApiKeySecret) return interaction.editReply('Failed to fetch tag details: Missing Auth credentials');

    const clickHouse = new URL(`https://queries.clickhouse.cloud/run/416ed1d8-6422-4e8d-9118-6702b57c6423?${params.toString()}`);
    const auth = Buffer.from(`${openApiKeyId}:${openApiKeySecret}`).toString("base64");

    try {
        const res = await fetch(clickHouse, {
            headers: {
                Authorization: `Basic ${auth}`,
            }
        });
        if (!res.ok) return interaction.editReply('Failed to fetch tag details: HTTP'+res.status);
        const { data }: IClickHouseResponse = await res.json();
        if (!data) return interaction.editReply('Failed to fetch tag info. Server response was blank');

        if (!data.length) return interaction.editReply('No results for requested query');

        const voteToString = (d: ITagDetail) => `- **${d["Tag Name"]}** :: [${d["Voted by"]}](https://nexusmods.com/users/${d["User ID"]}) on [${d["Mod Name"]}](https://nexusmods.com/mods/${d["Mod ID"]}?game_id=${d["Game ID"]})`;

        const upVotes = data.filter(t => t["Rating Type"] === 'Upvote (+1)').map(voteToString).join('\n')
        const downVotes = data.filter(t => t["Rating Type"] === 'Downvote (-1)').map(voteToString).join('\n');

        const content = (`${ratingType !== -1 ? `## 🔼 Upvotes\n${upVotes.length ? upVotes : '*No upvotes*'}\n` : ''}`+
            `${ratingType !== 1 ? `## 🔽 Downvotes\n${downVotes. length ? downVotes : '*No downvotes*'}` : ''}`).substring(0, 1995)

        return interaction.editReply({ content, flags: MessageFlags.SuppressEmbeds });

    }
    catch(err) {
        logger.warn('Failed to get tag info', err);
        return interaction.editReply('Failed to get tag votes:'+(err as Error).message);
    }

}

async function autocomplete(client: ClientExt, interaction: AutocompleteInteraction, logger: Logger) {
    const focused = interaction.options.getFocused(true);
    const gameId = interaction.options.getNumber('gameid');

    switch (focused.name) {
        case 'gameid': return autoCompleteGameID(client, interaction, logger);
        case 'modid': return autoCompleteModSearchIdOnly(interaction, logger, undefined, gameId || undefined);
        case 'userid': return autoCompleteUserSearch(interaction, logger);
    }
}

export { discordInteraction };