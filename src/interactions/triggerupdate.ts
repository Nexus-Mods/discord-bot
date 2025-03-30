import { CommandInteraction, SlashCommandBuilder, ChatInputCommandInteraction, GuildChannel, PermissionFlagsBits, MessageFlags } from "discord.js";
import { ClientExt, DiscordInteraction } from '../types/DiscordTypes';
import { Logger } from "../api/util";
import { getSubscribedChannel, setDateForAllSubsInChannel, updateSubscribedChannel } from "../api/subscriptions";

const timezones = [
    { name: 'UTC, GMT, Europe/London', value: '+00:00' },
    { name: 'Europe/Paris, Europe/Berlin', value: '+01:00' },
    { name: 'Asia/Tokyo', value: '+09:00' },
    { name: 'Asia/Kolkata', value: '+05:30' },
    { name: 'America/New York', value: '-05:00' },
    { name: 'America/Los Angeles', value: '-08:00' },
    { name: 'America/Chicago', value: '-06:00' },
    { name: 'America/Denver', value: '-07:00' },
    { name: 'Australia/Sydney', value: '+11:00' },
    { name: 'Asia/Dubai', value: '+04:00' },
    { name: 'Asia/Singapore', value: '+08:00' },
    { name: 'Africa/Johannesburg', value: '+02:00' }
];

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('trigger-update')
    .setDescription('Return a quick info message on a number of topics.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addStringOption(o =>
        o.setName('date')
        .setDescription('YYYY-MM-DD')
        .setRequired(false)
        .setMinLength(10)
        .setMaxLength(10)
    )
    .addStringOption(o =>
        o.setName('time')
        .setDescription('HH:MM')
        .setRequired(false)
        .setMinLength(5)
        .setMaxLength(5)
    )
    .addStringOption(o =>
        o.setName('timezone')
        .setDescription('Timezone to use')
        .setRequired(false)
        .setChoices(...timezones)
    ) as SlashCommandBuilder,
    public: true,
    guilds: [],
    action,
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({flags: MessageFlags.Ephemeral }).catch(err => { throw err });
    // Get any passed options
    const date = interaction.options.getString('date');
    const time = interaction.options.getString('time');
    const timezone = interaction.options.getString('timezone');
    let timeToUse
    // No options, use the time now
    if (!date && !time && !timezone) {
        timeToUse = new Date();
    }
    else if (!date && time) {
        const now = new Date();
        const [hrs, mins] = time.split(':');
        now.setHours(parseInt(hrs));
        now.setMinutes(parseInt(mins));
        timeToUse = now;
    }
    else {
        const dateString = `${date}T${time ?? '00:00'}:00${timezone ?? 'Z'}`
        timeToUse = new Date(dateString);
        if (isNaN(timeToUse.getTime())) {
            return interaction.editReply(`Invalid date: \`${dateString}\`. Remember to use the format YYYY-MM-DD HH:MM.`)
        }
    }
    // Update all subs to use this date.

    try {
        const epoch: number = Math.floor(timeToUse.getTime()/1000);
        let channel = await getSubscribedChannel(interaction.guildId!, interaction.channelId);
        if (!channel) return interaction.editReply('No subscribed items in this channel.');
        const update = await setDateForAllSubsInChannel(timeToUse, interaction.guildId!, interaction.channelId);
        channel = await updateSubscribedChannel(channel, timeToUse);
        logger.info('Subscription update triggered', { guild: interaction.guild?.name, channel: (interaction.channel as GuildChannel)?.name, timeToUse});
        await interaction.editReply(`Updates for all tracked items since <t:${epoch}:f> will be posted shortly.\n${update.map(i => i.title).join('\n')}`);
        await channel.webHookClient.send(`-# Update triggered by ${interaction.user.toString()} for updates since <t:${epoch}:f> for ${update.length} tracked item(s).`);
        await client.subscriptions?.getUpdatesForChannel(channel);
    }
    catch(err) {
        logger.warn('Error updating subsriptions', err);
        return interaction.editReply('An error occurred updating subscriptions: '+(err as Error).message);
    }
}

export { discordInteraction };