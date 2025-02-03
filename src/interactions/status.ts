import {ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getUserByDiscordId } from '../api/bot-db';
import { DiscordBotUser, DummyNexusModsUser } from "../api/DiscordBotUser";
import { IStatusPageFullResponse } from "../types/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check the status of the Nexus Mods website and services.')
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
    const botuser: DiscordBotUser = await getUserByDiscordId(discordId) ?? new DiscordBotUser(DummyNexusModsUser);

    try {
        const statusPage: IStatusPageFullResponse = await botuser.NexusMods.API.Other.WebsiteStatus(true) as IStatusPageFullResponse;
        const embed = new EmbedBuilder()
        .setTitle('Nexus Mods Status - '+statusPage.status.description)
        .setColor("DarkBlue")
        .setDescription(`
            ## Incidents\n
            ${statusPage.incidents.length ? statusPage.incidents.map(c => `${c.name}\n${c.incident_updates[0].body}`).join('\n'): 'None'}\n
            ## Planned Maintainece
            ${statusPage.scheduled_maintenances.length ? statusPage.scheduled_maintenances.map(c => `${c.name}\n${c.incident_updates[0].body}`).join('\n'): 'None'}
        `);
        return interaction.editReply({ embeds: [embed], content: `\`\`\`json\n${JSON.stringify(statusPage, null, 2)}\`\`\`` });
    }
    catch(err) {
        throw err;
    }
}

export { discordInteraction };