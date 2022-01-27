import { DiscordInteraction } from "../types/util";
import { NexusUser } from "../types/users";
import { getUserByDiscordId, userEmbed } from '../api/bot-db';
import { CommandInteraction, Snowflake, MessageEmbed, Client, CommandInteractionOption } from "discord.js";
import { SlashCommandBuilder } from '@discordjs/builders';

const discordInteraction: DiscordInteraction = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Show your profile card.')
        .addBooleanOption(option => 
            option.setName('public')
            .setDescription('Make your card visible to all users?')
            .setRequired(false)
        ),
    command: {
        name: 'profile',
        description: 'Show your profile card.',
        options: [{
            name: 'public',
            type: 'BOOLEAN',
            description: 'Make your card visible to all users?',
            required: false,
        }]
    },
    public: true,
    guilds: [
        '581095546291355649'
    ],
    action
}

async function action(client: Client, interaction: CommandInteraction): Promise<void> {
    // Private?
    const showValue : (CommandInteractionOption | null) = interaction.options.get('public');
    const show: boolean = !!showValue ? (showValue.value as boolean) : false;

    // Get sender info.
    const discordId: Snowflake | undefined = interaction.user.id;
    await interaction.deferReply({ephemeral: !show});
    // Check if they are already linked.
    let userData : NexusUser | undefined;

    // Currently, userEmbed requires a message, but there isn't one so we fake it until we make it. 
    const fakeMessage: any = {
        cleanContent: `/me`,
        author: {
            tag: interaction.user.tag
        }
    }

    try {
        userData = !!discordId ? await getUserByDiscordId(discordId) : undefined;
        if (!userData) interaction.followUp('You haven\'t linked your account yet. Use the /link command to get started.');
        else {
            const card: MessageEmbed = await userEmbed(userData, fakeMessage, client);
            interaction.followUp({ embeds: [card] });
        }
    }
    catch(err: any) {
        console.error('Error checking if user exists in DB when linking', err);
        interaction.followUp('An error occurred fetching your account details.');
    }

}

export { discordInteraction };