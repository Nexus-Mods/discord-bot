import { SlashCommandBuilder, type CommandInteraction, type Role, EmbedBuilder, InteractionContextType } from "discord.js";
import type { ClientExt, DiscordInteraction } from "../types/DiscordTypes.js";
import { ConditionType } from "../types/util.js";
import type { DiscordBotUser } from "../api/DiscordBotUser.js";
import { getConditionsForRole } from '@nexusmods/persistence/server_role_conditions.js';
import { getServer } from '@nexusmods/persistence/servers.js';
import type { BotServer } from "@nexusmods/persistence/types/servers.js";
import type { Logger } from "@nexusmods/core/logger.js";
import type { IConditionForRole } from "@nexusmods/persistence/server_role_conditions.js";
import type { InteractionContext } from '../lib/middleware.js';

const discordInteraction: DiscordInteraction = {
    command: new SlashCommandBuilder()
    .setName('claimrole')
    .setDescription('Claim a role in this server.')
    .setContexts(InteractionContextType.Guild) as SlashCommandBuilder,
    public: true,
    guilds: [],
    defer: 'ephemeral',
    requiresLink: true,
    action
}

async function action(client: ClientExt, interaction: CommandInteraction, logger: Logger, ctx: InteractionContext): Promise<any> {
    const user = ctx.user!;
    if (!interaction.guild) return interaction.reply('This command only works in servers.');
    
    // Defer while we check this out.

    // Get server info
    const server : BotServer = await getServer(interaction.guild);
    if (!server.role_author) return interaction.editReply('No claimable role in this server. Please check <id:customize> or [Linked Roles](https://support.discord.com/hc/en-us/articles/8063233404823-Connections-Linked-Roles-Community-Members#h_01GK286J648XF4HPGKZYW9AMQF) for more options.');

    try {
        await user.NexusMods.Auth();
        
    }
    catch(err) {
        logger.warn('Failed to get user info', err);
        return interaction.editReply('An error occured while verifying your account. Please [link your Nexus Mods account](https://discordbot.nexusmods.com/linked-role), to claim a role.')
    }

    const role: Role | null = await interaction.guild.roles.fetch(server.role_author);
    if (!role) return interaction.editReply('The claimable role in this server doesn\'t seem to exist anymore. \n-# ID: '+server.role_author);

    const conditions: IConditionForRole[] = await getConditionsForRole(server.id, server.role_author);
    const gameList = await client.gamesList?.getGames() ?? [];

    // Verify if the role can be assigned
    let shouldAllow = true;
    const conditionResults: (IConditionForRole & { result: 'skip' | 'pass' | 'fail' })[] = conditions.map(c => ({...c, result: 'skip'}));

    if (conditionResults.length) {
        let orChecks: boolean[] = [];
        // Process the rules
        for (const [i, condition] of conditionResults.entries()) {
            if (orChecks.length && condition.op === 'AND') {
                // We're doing an OR check but have moved onto an AND.
                if (!orChecks.includes(true)) {
                    // None of the previous OR checks passed, so we failed.
                    shouldAllow = false;
                   break;
                }
                // If this check passed, reset the array.
                else orChecks = [];
            }
            const pass = await evaluateCondition(condition, user).catch(() => false);
            if (pass === true) condition.result = 'pass';
            else condition.result = 'fail';

            if (!pass && condition.op === 'AND') {
                shouldAllow = false;
                break;
            }
            else if (condition.op === 'OR') orChecks.push(pass);

            // If the last check is an OR and none of the checks passed.
            if (i+1 === conditionResults.length && condition.op === 'OR') {
                if (!orChecks.includes(true)) {
                    // None of the previous OR checks passed, so we failed.
                    shouldAllow = false;
                    break;
                }
            }
        }
    }
    else shouldAllow = true;

    const resultsMessage = conditionResults.map(c => {
        let resEmoji = ''
        switch(c.result) {
            case "skip": resEmoji = '❔';
            break;
            case "pass": resEmoji = '✅';
            break;
            case "fail": resEmoji = '❌';
            break;
        }
        return `- ${resEmoji} ${c.min.toLocaleString()}+ ${ConditionType[c.type]} for ${gameList.find(g => g.domain_name === c.game)!.name} :: ${c.op}`
    });

    const embed = new EmbedBuilder()
    .setDescription(`**Role:** ${role.toString()}\n\n${resultsMessage.join('\n')}`);

    // Assign the role, or report the error.

    if (shouldAllow === false) {
        embed.setColor("DarkRed")
        .setTitle('You do not meet the criteria for this role')
        return interaction.editReply({ content: null, embeds: [embed] });
    }

    try {
        const member = await interaction.guild.members.fetch({ user: interaction.user })
        await member.roles.add(role);
        logger.info(`Assigned role ${role.name} to ${member.nickname}`);
        embed.setTitle('Role added!')
        .setColor("DarkGreen");
        return interaction.editReply({ content: null, embeds: [embed] });
    }
    catch(err) {
        if ((err as Error).message === 'Missing Permissions') {
            embed.setTitle('Missing Permissions!')
            .setColor('Red');
            return interaction.editReply({content: 'Failed to add role due to a permissions error. Please ensure this bot has the correct permissions.', embeds: [embed]});
        }
        logger.error('Failed to add role due to an error', err);
        return interaction.editReply('Failed to add role due to an error');
    }

}

async function evaluateCondition(condition: IConditionForRole, user: DiscordBotUser): Promise<boolean> {

    switch (condition.type) {
        case 'modDownloads' : {
            const mods = await user.NexusMods.API.v2.Mods(
                { 
                    uploaderId: [{ value: user.NexusMods.ID().toString(), op: 'EQUALS' }],
                    gameDomainName: [{ value: condition.game, op: 'EQUALS' }]
                }, 
                { downloads: { direction: 'DESC' } });
            const total = mods.nodes.reduce((prev, cur) => prev + cur.downloads, 0);
            return (total >= condition.min);
        }
        case 'modsPublished' : {
            const mods = await user.NexusMods.API.v2.Mods(
                { 
                    uploaderId: [{ value: user.NexusMods.ID().toString(), op: 'EQUALS' }],
                    gameDomainName: [{ value: condition.game, op: 'EQUALS' }]
                }, 
                { downloads: { direction: 'DESC' } });

            return (mods.totalCount >= condition.min);
        }
        default: throw new Error(`Unrecognised condition type: ${condition.type}`)
    }
}

export { discordInteraction };