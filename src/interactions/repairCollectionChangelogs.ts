import { 
    CommandInteraction, Snowflake, EmbedBuilder, Client, SlashCommandBuilder, PermissionFlagsBits, 
    ChatInputCommandInteraction, MessageFlags, InteractionContextType, AutocompleteInteraction
} from "discord.js";
import { ClientExt, DiscordInteraction } from "../types/DiscordTypes";
import { getUserByDiscordId } from '../api/bot-db';
import { autoCompleteCollectionSearch, KnownDiscordServers, Logger } from '../api/util';
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('repair-collection-changelogs')
    .setDescription('Repair issues with collection changelogs.')
    .addStringOption(so =>
        so.setName('collection')
        .setDescription('Collection to repair. Automatically completes.')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    public: false,
    guilds: [
        KnownDiscordServers.Author,
        KnownDiscordServers.BotDemo
    ],
    action,
    autocomplete
}

async function action(client: Client, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId: Snowflake = interaction.user.id;
    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    const collectionID = interaction.options.getString('collection', true);
    if (!collectionID) {
        return interaction.editReply('Collection not found. Please try again.');
    }
    // Get the info for the user and the collection
    try {
        const user: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
        if (!user) return interaction.editReply('You need to link your Nexus Mods account first using `/link`.');
        await user.NexusMods.Auth();
        const [gameDomain, slug] = collectionID.split(':');
        if (!gameDomain || !slug) {
            return interaction.editReply('Invalid collection ID. Please use the format `gameDomain:slug` if the autocomplete fails.');
        }
        const collection = await user.NexusMods.API.v2.Collection(slug, gameDomain, true);
        if (!collection) {
            return interaction.editReply('Collection not found. Please try again.');
        }
        const revisions = await user.NexusMods.API.v2.CollectionRevisions(gameDomain, slug);
        const brokenRevisions = revisions?.revisions.filter(r => r.collectionChangelog === null) ?? [];
        if (!brokenRevisions.length) return interaction.editReply('No broken changelogs found for this collection.\n\n '+JSON.stringify(revisions?.revisions[0], null, 2));
        else await interaction.editReply(`Found ${brokenRevisions.length} broken changelogs for collection \`${collection.name}\` (${collection.slug}). Attempting to repair...`);

        const successfulRepairs: string[] = [];
        const failedRepairs: string[] = [];
        
        for (const revision of brokenRevisions) {
            const repairResult = await user.NexusMods.API.v2.CreateCollectionRevisionChangelog(revision.id.toString());
            if (repairResult) successfulRepairs.push(`Revision ${revision.revisionNumber} (${revision.updatedAt})`);
            else failedRepairs.push(`Revision ${revision.revisionNumber} (${revision.updatedAt})`);
        }

        const response = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Collection Changelog Repair Results')
            .setDescription(`Successfully repaired ${successfulRepairs.length} changelogs and failed to repair ${failedRepairs.length} changelogs.`)
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();
        if (successfulRepairs.length) response.addFields({ name: 'Successful Repairs', value: successfulRepairs.join('\n') || 'None', inline: false });
        if (failedRepairs.length) response.addFields({ name: 'Failed Repairs', value: failedRepairs.join('\n') || 'None', inline: false });


        return interaction.editReply({ content: '', embeds: [response] }).catch(undefined);
    }
    catch(err) {
        logger.warn('Error in /link command', err);
        return interaction.editReply('Unexpected error! '+(err as Error).message);
    }

}

async function autocomplete(client: ClientExt, interaction: AutocompleteInteraction, logger: Logger) {
    return autoCompleteCollectionSearch(interaction, logger);
}

export { discordInteraction };