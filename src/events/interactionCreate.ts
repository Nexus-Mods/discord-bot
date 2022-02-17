import { Interaction, MessageContextMenuInteraction, CommandInteraction, UserContextMenuInteraction } from 'discord.js';
import { ClientExt } from "../types/util";
import { DiscordInteraction, DiscordInteractionType } from '../types/util';
import { unexpectedErrorEmbed, logMessage } from '../api/util';

async function main(client: ClientExt, i: Interaction) {
    const interaction = resolveCommandType(i);
    if (!interaction) return; // Probably a button interaction or something? 

    const interact: DiscordInteraction = client.interactions?.get(interaction.commandName);
    if (!interact) return logMessage('Invalid interaction requested', {name: interaction.commandName, i: client.interactions, commands: await interaction.guild?.commands.fetch()}, true);
    else {
        logMessage('Interaction Triggered', 
        { 
            command: !i.isCommand() ? interaction.commandName : interaction.toString(),
            requestedBy: interaction.user.tag, 
            server: `${interaction.guild?.name} (${interaction.guildId})`,
            channelName: (interaction.channel as any)?.name,
        }
        );
        interact.action(client, interaction).catch((err) => {
            const context = {
                server: `${interaction.guild?.name} (${interaction.guildId})`,
                channelName: (interaction.channel as any)?.name,
                requestedBy: interaction.user.tag,
                botVersion: process.env.npm_package_version,
                interaction: !i.isCommand() ? interaction.commandName : interaction.toString(),
                error: err.message || err
            }
            const reply = { embeds: [unexpectedErrorEmbed(err, context)], components: [], content: null };

            if (err.message === 'Unknown interaction') {
                return logMessage('Unknown interaction error', { err, inter: interaction, ...context });
            }
            else logMessage('Interaction action errored out', { interact: interaction, ...context });
            
            (interaction.replied || interaction.deferred) 
            ? interaction.editReply(reply).catch(replyError => {
                logMessage('Error editing reply for failed interaction', {replyError, ...context, interact: interaction}, true);
                process.exit(1);
            })
            : interaction.reply(reply).catch(replyError => {
                logMessage('Error replying to failed interaction', {replyError, ...context, interact: interaction}, true);
                process.exit(1);
            });
        });
    } 
}

function resolveCommandType(interaction: Interaction): DiscordInteractionType|undefined {
    if (interaction.isCommand()) return (interaction as CommandInteraction);
    else if (interaction.isUserContextMenu()) return (interaction as UserContextMenuInteraction);
    else if (interaction.isMessageContextMenu()) return (interaction as MessageContextMenuInteraction);
} 




export default main;