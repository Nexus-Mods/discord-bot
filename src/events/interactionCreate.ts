import { CommandInteraction } from 'discord.js';
import { ClientExt } from '../DiscordBot';
import { DiscordInteraction } from '../types/util';
import { unexpectedErrorEmbed, logMessage } from '../api/util';

async function main(client: ClientExt, interaction: CommandInteraction) {
    if (!interaction.isCommand()) return;
    // console.log(interaction);

    const interact: DiscordInteraction = client.interactions?.get(interaction.commandName);
    if (!interact) return console.error('Invalid interaction requested', interaction);
    else {
        try {
            return interact.action(client, interaction);
        }
        catch(err) {
            const context = {
                serverId: interaction.guildId,
                serverName: interaction.guild?.name,
                channelName: interaction.channel?.toString(),
                requestedBy: interaction.user.tag,
                botVersion: process.version,
                interaction: interaction.commandName,
                error: err.message || err
            }
            return interaction.reply({ embeds: [unexpectedErrorEmbed(err, context)] })
            .catch((replyError) => logMessage('Error replying to failed interaction', {replyError, ...context}, true));
        }
    } 
}


export default main;