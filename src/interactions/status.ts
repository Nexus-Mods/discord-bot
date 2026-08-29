import {ChatInputCommandInteraction, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { DiscordInteraction, ClientExt } from "../types/DiscordTypes.js";
import { getUserByDiscordId } from '../api/users.js';
import { DiscordBotUser, DummyNexusModsUser } from "../api/DiscordBotUser.js";
import { IStatusPageFullResponse } from "../types/util.js";
import { KnownDiscordServers, Logger } from "../api/util.js";

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
    defer: 'ephemeral',
    action
}

async function action(client: ClientExt, baseInteraction: CommandInteraction, logger: Logger): Promise<any> {
    const interaction = (baseInteraction as ChatInputCommandInteraction);
    const discordId = interaction.user.id;
    const botuser: DiscordBotUser = await getUserByDiscordId(discordId) ?? new DiscordBotUser(DummyNexusModsUser, logger);

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
        logger.warn('Could not fetch the Nexus Mods status page', err);
        throw err;
    }
}

export { discordInteraction };