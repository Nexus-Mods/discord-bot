import { CommandInteraction, Client, MessageEmbed, MessageActionRow, MessageSelectMenu, MessageSelectOptionData, MessageButton, Message } from "discord.js";
import { DiscordInteraction, } from "../types/util";
import { NexusUser, NexusLinkedMod } from "../types/users";
import { getUserByDiscordId, getModsbyUser, deleteMod, updateAllRoles } from '../api/bot-db';
import { logMessage } from '../api/util';

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'removemod',
        description: 'Associate a mod with your Discord account.',
    },
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<any> {
    logMessage('Remove mod interaction triggered', { user: interaction.user, guild: interaction.guild, channel: interaction.channel });

    await interaction.deferReply({ ephemeral: true });

    // Get existing user data and mods.
    const discordId: string = interaction.user.id;
    const user: NexusUser = await getUserByDiscordId(discordId);
    if (!user) return interaction.editReply({ content: 'You do not have a Nexus Mods account linked to your profile. Use /link to get stared.' });
    const mods: NexusLinkedMod[] = await getModsbyUser(user.id).catch(() => []);

    // If the user has no mods, we can exit here! 
    if (!mods.length) return interaction.editReply({ content: 'You do not have any mods linked to your profile.' });

    const options: MessageSelectOptionData[] = mods.map((m, idx) => ({ label: m.name, description: m.game, value: m.path }));

    const components: MessageActionRow[] = [
        new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
            .setCustomId('mod-selector')
            .setPlaceholder('Select mods to remove...')
            .setMaxValues(options.length)
            .setMinValues(1)
            .addOptions(options)
        ),
        new MessageActionRow()
        .addComponents(
            new MessageButton()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setStyle('SECONDARY'),
            new MessageButton()
            .setStyle('DANGER')
            .setCustomId('remove-all')
            .setLabel('Remove All')
        )
    ];

    await interaction.editReply({ embeds: [selectEmbed(client, user)], components });

    const message = await interaction.fetchReply();
    const collector = (message as Message).createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
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
            await updateAllRoles(client, user, interaction.user, false);
            i.editReply({ embeds: [completedEmbed(client, user, removals)] });
        }
        catch(err) {
            logMessage('Error removing mods', { removals, err }, true);
            i.editReply({ content: `There was an error trying to remove those mods: ${err.message || err}` });
        }
    });
}

async function removeMods (mods: NexusLinkedMod[]) {
    Promise.all(mods.map(async m => deleteMod(m)))
}

const selectEmbed = (client: Client, user: NexusUser): MessageEmbed => {
    return new MessageEmbed()
    .setTitle('Select Mods to remove')
    .setDescription('Use the drop-down menu below to select which mods you wish to remove.')
    .setThumbnail(user.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
}

const completedEmbed = (client: Client, user: NexusUser, modsRemoved: NexusLinkedMod[]): MessageEmbed => {
    const modsText: string = modsRemoved.map(m => `- [${m.name}](https://nexusmods.com/${m.path})`).join('\n');
    return new MessageEmbed()
    .setTitle('Mods Removed')
    .setDescription('The following mods have been successfully removed from your Discord account:\n'+modsText)
    .setThumbnail(user.avatar_url || 'https://www.nexusmods.com/assets/images/default/avatar.png')
    .setColor(0xda8e35)
    .setFooter({ text: 'Nexus Mods API link', iconURL: client.user?.avatarURL() || '' })
}

export { discordInteraction };