import { CommandInteraction } from 'discord.js';
import { ClientExt } from '../DiscordBot';
import { DiscordInteraction } from '../types/util';

async function main(client: ClientExt, interaction: CommandInteraction) {
    if (!interaction.isCommand()) return;
    // console.log(interaction);

    const interact: DiscordInteraction = client.interactions?.get(interaction.commandName);
    if (!interact) return console.error('Invalid interaction requested', interaction);
    else return interact.action(client, interaction);
}


export default main;