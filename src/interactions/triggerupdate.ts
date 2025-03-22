import { 
    CommandInteraction, EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction,
    TextChannel, Collection, Snowflake, Webhook
} from "discord.js";
import { ClientExt, DiscordInteraction } from '../types/DiscordTypes';
import { autoCompleteCollectionSearch, autocompleteGameName, autoCompleteModSearch, autoCompleteUserSearch, logMessage } from "../api/util";
import { SubscribedChannel, SubscribedItemType } from "../types/subscriptions";
import { getSubscribedChannel, setDateForAllSubsInChannel, updateSubscribedChannel } from "../api/subscriptions";
import { DiscordBotUser, DummyNexusModsUser } from "../api/DiscordBotUser";

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
    public: false,
    guilds: [
        '581095546291355649'
    ],
    action,
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ ephemeral: true }).catch(err => { throw err });
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
    logMessage('Date give is', timeToUse);

    try {
        let channel = await getSubscribedChannel(interaction.guildId!, interaction.channelId);
        if (!channel) return interaction.editReply('No subscribed items in this channel.');
        const update = await setDateForAllSubsInChannel(timeToUse, interaction.guildId!, interaction.channelId);
        channel = await updateSubscribedChannel(channel, timeToUse);
        await interaction.editReply(`Updates for all tracked items since <t:${Math.floor(timeToUse.getTime()/1000)}:t> will be posted shortly.\n${update.map(i => i.title).join('\n')}`);
        await client.subscriptions?.getUpdatesForChannel(channel);
    }
    catch(err) {
        return interaction.editReply('An error occurred updating subscriptions');
    }
}

export { discordInteraction };