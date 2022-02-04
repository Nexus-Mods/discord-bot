import { CommandInteraction, Client, MessageEmbed, MessageActionRow, MessageButton } from "discord.js";
import { DiscordInteraction, } from "../types/util";
import { getAllUsers, getAllGameFeeds } from '../api/bot-db';
import { NexusUser } from "../types/users";
import { GameFeed } from "../types/feeds";
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'about',
        description: 'Information about this bot.',
        options: [
            {
                name: 'private',
                type: 'BOOLEAN',
                description: 'Only show to me.',
                required: false
            }
        ]
    },
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

async function action(client: Client, interaction: CommandInteraction): Promise<any> {
    
    const option: boolean | null = interaction.options.getBoolean('private');
    const ephemeral: boolean = option !== null ? option : true;

    logMessage('About interaction triggered', { user: interaction.user.tag, guild: interaction.guild?.name, channel: (interaction.channel as any)?.name, ephemeral });

    await interaction.deferReply({ ephemeral }).catch((err) => { throw err });
    
    const upTime: string = calcUptime(process.uptime());
    const allUsers: NexusUser[] = await getAllUsers();
    const allFeeds: GameFeed[] = await getAllGameFeeds();

    const botPermsissons: string[] = interaction.guild?.me?.permissions.toArray() || [];

    const permissionsList: string = buildPermsList(botPermsissons, minPermissions);

    const info: MessageEmbed = new MessageEmbed()
    .setTitle(`Nexus Mods Discord Bot v${process.env.npm_package_version}`)
    .setColor(0xda8e35)
    .setThumbnail(client.user?.avatarURL() || '')
    .setDescription(`Integrate your community with Nexus Mods using our Discord bot. Link accounts, search, get notified of the latest mods for your favourite games and more.`)
    // .addField('Support', 'If you have feedback or questions about this bot, check out the [documentation](https://modding.wiki/nexusmods/discord-bot) or head over to the [Nexus Mods Discord Server](https://discord.gg/nexusmods).')
    .addField('Minimum Permissions', permissionsList, true)
    .addField('Stats', 
        `Servers: ${client.guilds.cache.size.toLocaleString()}\n`+
        `Linked Accounts: ${allUsers.length.toLocaleString()}\n`+
        `Game Feeds: ${allFeeds.length.toLocaleString()}`
    , true)
    .setFooter({ text: `Uptime: ${upTime}`, iconURL: client.user?.avatarURL() || '' })
    .setTimestamp(new Date());

    const buttons = new MessageActionRow()
    .addComponents(
        new MessageButton({
            label: 'Docs',
            style: 'LINK',
            url: 'https://modding.wiki/nexusmods/discord-bot'
        }),
        new MessageButton({
            label: 'Support',
            style: 'LINK',
            url: 'https://discord.gg/nexusmods'
        }),
        new MessageButton({
            label: 'Source (GitHub)',
            style: 'LINK',
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