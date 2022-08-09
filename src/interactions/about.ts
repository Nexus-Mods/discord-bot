import { 
    Client, SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageActionRowComponentBuilder 
} from "discord.js";
import { DiscordInteraction, } from "../types/DiscordTypes";
import { getAllUsers, getAllGameFeeds } from '../api/bot-db';
import { NexusUser } from "../types/users";
import { GameFeed } from "../types/feeds";

const command = new SlashCommandBuilder()
.setName('about')
.setDescription('Information about this bot.')
.addBooleanOption(option => 
    option.setName('private')
    .setDescription('Only show to me.')
    .setRequired(false)
)
.setDMPermission(true)
.setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

const discordInteraction: DiscordInteraction = {
    // command: {
    //     name: 'about',
    //     description: 'Information about this bot.',
    //     options: [
    //         {
    //             name: 'private',
    //             type: 'BOOLEAN',
    //             description: 'Only show to me.',
    //             required: false
    //         }
    //     ]
    // },
    command,
    public: true,
    action
}

const minPermissions: { name: string, code: string }[] = [
    {
        name: 'Read Messages/View Channels',
        code: 'VIEW_CHANNEL',
    },
    {
        name: 'Send Messages',
        code: 'SEND_MESSAGES'
    },
    {
        name: 'Manage Webhooks (Optional)',
        code: 'MANAGE_WEBHOOKS'
    },
    {
        name: 'Manage Roles (Optional)',
        code: 'MANAGE_ROLES'
    }
];

async function action(client: Client, interaction: ChatInputCommandInteraction): Promise<any> {

    const option: boolean | null = interaction.options.getBoolean('private');
    const ephemeral: boolean = option !== null ? option : true;

    // logMessage('About interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name, ephemeral });

    await interaction.deferReply({ ephemeral }).catch((err) => { throw err });
    
    const upTime: string = calcUptime(process.uptime());
    const allUsers: NexusUser[] = await getAllUsers();
    const allFeeds: GameFeed[] = await getAllGameFeeds();

    const botPermsissons: string[] = interaction.guild?.members.me?.permissions.toArray() || [];

    const permissionsList: string = buildPermsList(botPermsissons, minPermissions);

    const info = new EmbedBuilder()
    .setTitle(`Nexus Mods Discord Bot v${process.env.npm_package_version}`)
    .setColor(0xda8e35)
    .setThumbnail(client.user?.avatarURL() || '')
    .setDescription(`Integrate your community with Nexus Mods using our Discord bot. Link accounts, search, get notified of the latest mods for your favourite games and more.`)
    .addFields([
        {
            name: 'Minimum Permissions',
            value: permissionsList,
            inline: true
        },
        {
            name: 'Stats',
            value: `Servers: ${client.guilds.cache.size.toLocaleString()}\n`+
            `Linked Accounts: ${allUsers.length.toLocaleString()}\n`+
            `Game Feeds: ${allFeeds.length.toLocaleString()}`,
            inline: true
        },
    ])
    .setFooter({ text: `Uptime: ${upTime}`, iconURL: client.user?.avatarURL() || '' })
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

function buildPermsList(current: string[], required: { name: string, code: string }[]): string {
    const list = required.reduce((prev, cur) => {
        if (current.includes(cur.code) || current.includes('ADMINISTRATOR')) {
            prev = prev + `✅ ${cur.name}\n`;
        }
        else prev = prev + `❌ ${cur.name}\n`;
        return prev;
    }, '');

    return list;
}

function calcUptime(seconds: number): string {
    const days = Math.floor(seconds/86400);
    seconds -= (days * 86400);
    const hours = Math.floor(seconds/3600);
    seconds -= (hours * 3600);
    const minutes = Math.floor(seconds/60);
    seconds -= (minutes * 60);
    return `${days}d ${hours}h ${minutes}m ${seconds.toFixed()}s`;
}

export { discordInteraction };