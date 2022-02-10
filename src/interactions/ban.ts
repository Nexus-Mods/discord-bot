import { CommandInteraction, Client, User } from "discord.js";
import { DiscordInteraction, } from "../types/util";
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: {
        name: 'ban',
        description: 'Ban a user from this server.',
        options: [
            {
                name: 'user',
                type: 'USER',
                description: 'User to ban.',
                required: true
            },
            {
                name: 'reason',
                type: 'STRING',
                description: 'Why are they being banned?',
                required: true
            },
            {
                name: 'removeposts',
                type: 'INTEGER',
                description: 'Remove posts from the last X days'
            }
        ]
    },
    public: false,
    guilds: [
        '581095546291355649',
        '215154001799413770'
    ],
    permissions: [
        {
            // Available to moderators in the Nexus Mods server
            guild: '215154001799413770',
            id: '215507179396923392',
            type: 'ROLE',
            permission: true
        }
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<any> {
    
    const userToBan: User | null = interaction.options.getUser('user');
    const reason: string | null = interaction.options.getString('reason');
    const postDays: number = interaction.options.getInteger('removeposts') || 0;

    logMessage('Ban interaction triggered', 
    { 
        user: interaction.user.tag, guild: 
        interaction.guild?.name, 
        channel: (interaction.channel as any)?.name,
        ban: { user: userToBan?.tag, reason }
    });

    return interaction.reply('Command not ready. Do we still need this?')

}

// export { discordInteraction };