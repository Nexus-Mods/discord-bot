import { CommandInteraction } from 'discord.js';
import { ClientExt } from "../types/util";
import { DiscordInteraction } from '../types/util';
import { unexpectedErrorEmbed, logMessage } from '../api/util';

async function main(client: ClientExt, interaction: CommandInteraction) {
    if (!interaction.isCommand()) return;
    // console.log(interaction);

    const interact: DiscordInteraction = client.interactions?.get(interaction.commandName);
    if (!interact) return console.error('Invalid interaction requested', interaction);
    else {
        interact.action(client, interaction).catch((err) => {
            const context = {
                serverId: interaction.guildId,
                serverName: interaction.guild?.name,
                channelName: interaction.channel?.toString(),
                requestedBy: interaction.user.tag,
                botVersion: process.env.npm_package_version,
                interaction: interaction.commandName,
                error: err.message || err
            }
            const repFunc = interaction.replied ? interaction.reply : interaction.editReply;
            return repFunc({ embeds: [unexpectedErrorEmbed(err, context)], components: [], content: null })
            .catch((replyError) => {
                logMessage('Error replying to failed interaction', {replyError, ...context}, true);
                process.exit(1);
            });
        });
    } 
}


export default main;