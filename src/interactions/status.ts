import {ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes";
import { getUserByDiscordId } from '../api/bot-db';
import { DiscordBotUser, DummyNexusModsUser } from "../api/DiscordBotUser";
import { IStatusPageFullResponse } from "../types/util";
import { KnownDiscordServers } from "../api/util";

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check the status of the Nexus Mods website and services.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    public: false,
    guilds: [
        KnownDiscordServers.BotDemo,
        KnownDiscordServers.Moderator,

    ],
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
        return interaction.editReply({ embeds: [embed] });
    }
    catch(err) {
        throw err;
    }
}

export { discordInteraction };