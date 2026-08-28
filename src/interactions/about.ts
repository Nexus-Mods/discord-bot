import { 
    Client, SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageActionRowComponentBuilder, CommandInteraction, 
    InteractionContextType
} from "discord.js";
import { DiscordInteraction } from "../types/DiscordTypes.js";
import { getCountOfUsers } from '../api/bot-db.js';
import { calcUptime, Logger } from "../api/util.js";
import { getCountOfSubscriptions } from "../api/subscriptions.js";
import { NEXUS_ORANGE, botIconUrl } from '../lib/embeds.js';

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('about')
    .setDescription('Information about this bot.')
    .addBooleanOption(option => 
        option.setName('private')
        .setDescription('Only show to me.')
        .setRequired(false)
    )
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM])
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages) as SlashCommandBuilder,
    public: true,
    defer: (i) => (i as ChatInputCommandInteraction).options.getBoolean('private') ?? true ? 'ephemeral' : 'public',
    action
}

// const minPermissions: { name: string, code: string }[] = [
//     {
//         name: 'Read Messages/View Channels',
//         code: 'VIEW_CHANNEL',
//     },
//     {
//         name: 'Send Messages',
//         code: 'SEND_MESSAGES'
//     },
//     {
//         name: 'Manage Webhooks (Optional)',
//         code: 'MANAGE_WEBHOOKS'
//     },
//     {
//         name: 'Manage Roles (Optional)',
//         code: 'MANAGE_ROLES'
//     }
// ];

async function action(client: Client, baseInteraction: CommandInteraction, _logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);


    
    const upTime: string = calcUptime(process.uptime());
    const allUsers: number = await getCountOfUsers().catch(() => 0);
    const allFeeds = await getCountOfSubscriptions().catch(() => 0);

    let guildCount = client.guilds.cache.size;
    if (client.shard) {
        const shardTotals = await client.shard.broadcastEval((client) => client.guilds.cache.size);
        guildCount = shardTotals.reduce((prev, cur) => prev+=cur, 0);
    }


    // const botPermissons: string[] = interaction.guild?.members.me?.permissions.toArray() || [];

    // const permissionsList: string = buildPermsList(botPermsissons, minPermissions);

    const info = new EmbedBuilder()
    .setTitle(`Nexus Mods Discord Bot v${process.env.npm_package_version}`)
    .setColor(NEXUS_ORANGE)
    .setThumbnail(botIconUrl(client))
    .setDescription(`Integrate your community with Nexus Mods using our Discord bot. Link accounts, search, get notified of the latest mods for your favourite games and more.`)
    .addFields([
        {
            name: 'Stats',
            value: `Servers: ${guildCount.toLocaleString()}\n`+
            `Linked Accounts: ${allUsers.toLocaleString()}\n`+
            `Subscribed Items: ${allFeeds.toLocaleString()}`,
            inline: true
        },
    ])
    .setFooter({ text: `Uptime: ${upTime}`, iconURL: botIconUrl(client) })
    .setTimestamp(new Date());

    const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
        new ButtonBuilder({
            label: 'Docs',
            style: ButtonStyle.Link,
            url: 'https://modding.wiki/nexusmods/discord-bot'
        }),
        new ButtonBuilder({
            label: 'Support',
            style: ButtonStyle.Link,
            url: 'https://discord.gg/nexusmods'
        }),
        new ButtonBuilder({
            label: 'Source (GitHub)',
            style:  ButtonStyle.Link,
            url: 'https://github.com/Nexus-Mods/discord-bot'
        })
    );

    return interaction.editReply({ embeds: [info], components: [buttons] }).catch(err => { throw err });
}

export { discordInteraction };