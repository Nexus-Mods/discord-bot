import { CommandInteraction } from 'discord.js';
import { ClientExt } from "../types/util";
import { DiscordInteraction } from '../types/util';
import { unexpectedErrorEmbed, logMessage } from '../api/util';

async function main(client: ClientExt, interaction: CommandInteraction) {
    if (!interaction.isCommand()) return;
    // console.log(interaction);

    const interact: DiscordInteraction = client.interactions?.get(interaction.commandName);
    if (!interact) return logMessage('Invalid interaction requested', interaction, true);
    else {
        logMessage('Slash command', 
        { 
            command: interaction.toString(), 
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
                interaction: interaction.toString(),
                error: err.message || err
            }
            const reply = { embeds: [unexpectedErrorEmbed(err, context)], components: [], content: null };
            
            interaction.followUp(reply).catch(replyError => {
                logMessage('Error following up for failed interaction', { replyError, ...context, inter: interaction}, true);
                process.exit(1);
            })
            
            // (interaction.replied || interaction.deferred) 
            // ? interaction.editReply(reply).catch(replyError => {
            //     logMessage('Error editing reply for failed interaction', {replyError, ...context}, true);
            //     process.exit(1);
            // })
            // : interaction.reply(reply).catch(replyError => {
            //     logMessage('Error replying to failed interaction', {replyError, ...context}, true);
            //     process.exit(1);
            // });
        });
    } 
}


export default main;