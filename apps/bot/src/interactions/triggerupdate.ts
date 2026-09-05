import { type CommandInteraction, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildChannel, PermissionFlagsBits, InteractionContextType } from "discord.js";
import type { ClientExt, DiscordInteraction } from '../types/DiscordTypes.js';
import type { Logger } from "@nexusmods/core/logger.js";
import { getSubscribedChannel } from "../api/subscriptions.js";
import { webhookFor } from '../feeds/webhooks.js';
import { getSubscribedItems } from '../api/subscriptions.js';

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
    .setContexts(InteractionContextType.Guild)
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
    defer: 'ephemeral',
    action,
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
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
        const channel = await getSubscribedChannel(interaction.guildId!, interaction.channelId);
        if (!channel) return interaction.editReply('No subscribed items in this channel.');
        logger.info('Subscription update triggered', { guild: interaction.guild?.name, channel: (interaction.channel as GuildChannel)?.name, timeToUse});
        await webhookFor(channel).send(`-# Update triggered by ${interaction.user.toString()} for updates since <t:${epoch}:f> for ${(await getSubscribedItems(channel)).length} tracked item(s).`);
        await client.subscriptions?.forceChannnelUpdate(channel,timeToUse);
        await interaction.editReply(`Updates for all tracked items since <t:${epoch}:f> will be posted shortly.`);
    }
    catch(err) {
        logger.warn('Error updating subsriptions', err);
        return interaction.editReply('An error occurred updating subscriptions: '+(err as Error).message);
    }
}

export { discordInteraction };