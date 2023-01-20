import { ChatInputCommandInteraction, CommandInteraction, Interaction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
// import { logMessage } from "../api/util";
import { getUserByDiscordId } from '../api/bot-db';
import { NexusModsGQLClient } from "../api/NexusModsGQLClient";
import { logMessage } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Testing GQL.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        '581095546291355649',
        '268004475510325248',

    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ ephemeral: true });
    const discordId = interaction.user.id;
    const user = await getUserByDiscordId(discordId);
    const initial = { access_token: user.nexus_access?.substring(-10), refresh_token: user.nexus_refresh, expires_at: user.nexus_expires };
    const initialString = '```'+JSON.stringify(initial, null, 2)+'```';
    const GQL = await NexusModsGQLClient.create(user);
    const updated = await GQL.getAccessToken();
    updated.access_token = updated.access_token.substring(-10);
    const updatedString = '```'+JSON.stringify(updated, null, 2)+'```';
    logMessage('Same tokens?', initialString == updatedString);
    try {
        return interaction.editReply(`${initialString}\n\n${updatedString}`);
    }
    catch(err) {
        return interaction.editReply({ content: 'Error! '+err });
    }
}

export { discordInteraction }