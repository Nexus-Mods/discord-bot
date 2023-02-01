import { 
    CommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    Message, ButtonStyle, SlashCommandBuilder, SelectMenuBuilder, 
    SelectMenuOptionBuilder, 
    ChatInputCommandInteraction,
    MessageComponentInteraction
} from "discord.js";
import { DiscordInteraction, } from "../types/DiscordTypes";
import { NexusLinkedMod } from "../types/users";
import { getUserByDiscordId, getModsbyUser, deleteMod, updateAllRoles } from '../api/bot-db';
import { logMessage } from '../api/util';
import { DiscordBotUser } from "../api/DiscordBotUser";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('removemod')
    .setDescription('Remove a mod associated with your Discord account.'),
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}
async function action(client: Client, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    // logMessage('Remove mod interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name });

    await interaction.deferReply({ ephemeral: true }).catch(err => { throw err });;

    // Get existing user data and mods.
    const discordId: string = interaction.user.id;
    const user: DiscordBotUser|undefined = await getUserByDiscordId(discordId);
    if (!user) return interaction.editReply({ content: 'You do not have a Nexus Mods account linked to your profile. Use /link to get stared.' });
    const mods: NexusLinkedMod[] = await getModsbyUser(user.NexusModsId).catch(() => []);

    // If the user has no mods, we can exit here! 
    if (!mods.length) return interaction.editReply({ content: 'You do not have any mods linked to your profile.' });

    const options: SelectMenuOptionBuilder[] = mods.map((m) =>  new SelectMenuOptionBuilder().setLabel(m.name).setDescription(m.game).setValue(m.path));

    const components: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>[] = [
        new ActionRowBuilder<SelectMenuBuilder>()
        .addComponents(
            new SelectMenuBuilder()
            .setCustomId('mod-selector')
            .setPlaceholder('Select mods to remove...')
            .setMaxValues(options.length)
            .setMinValues(1)
            .addOptions(options)
        ),
        new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
            .setStyle(ButtonStyle.Danger)
            .setCustomId('remove-all')
            .setLabel('Remove All')
        )
    ];

    await interaction.editReply({ embeds: [selectEmbed(client, user)], components });

    const message = await interaction.fetchReply();
    const collector = (message as Message).createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (i: MessageComponentInteraction) => {
        await i.update({ components: [] });
        let removals: NexusLinkedMod[] = [];
        if (i.isButton()) {
            if (i.customId === 'remove-all') {
                collector.stop('Remove all');
                removals = mods;
            }
            else if (i.customId === 'cancel') {
                collector.stop('Cancelled');
            }
        }
        else if (i.isSelectMenu()) {
            const selected = mods.filter(m => i.values.includes(m.path));
            removals = selected;
        }

        try {
            if (!removals.length) {
                i.editReply({ content: 'No mods removed.', embeds: [] });
                return;
            }
            await removeMods(removals);
            await i.editReply({ embeds: [completedEmbed(client, user, removals)] }).catch(undefined);
            await updateAllRoles(client, user, interaction.user, false);
        }
        catch(err) {
            logMessage('Error removing mods', { removals, err }, true);
            i.editReply({ content: `There was an error trying to remove those mods: ${(err as Error).message || err}` });
        }
    });
}

async function removeMods (mods: NexusLinkedMod[]) {
    Promise.all(mods.map(async m => deleteMod(m)))
}

const selectEmbed = (client: Client, user: DiscordBotUser): EmbedBuilder => {
    return new EmbedBuilder()
    .setTitle('Select Mods to remove')
    .setDescription('Use the drop-down menu below to select which mods you wish to remove.')
    .setThumbnail(user.NexusModsAvatar || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
}

const completedEmbed = (client: Client, user: DiscordBotUser, modsRemoved: NexusLinkedMod[]): EmbedBuilder => {
    const modsText: string = modsRemoved.map(m => `- [${m.name}](https://nexusmods.com/${m.path})`).join('\n');
    return new EmbedBuilder()
    .setTitle('Mods Removed')
    .setDescription('The following mods have been successfully removed from your Discord account:\n'+modsText)
    .setThumbnail(user.NexusModsAvatar || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
}

export { discordInteraction };