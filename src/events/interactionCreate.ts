import { Interaction } from 'discord.js';
import { ClientExt } from '../DiscordBot';
import { DiscordInteraction } from '../types/util';

async function main(client: ClientExt, interaction: Interaction) {
    if (!interaction.isCommand()) return;
    // console.log(interaction);

    const interact: DiscordInteraction = client.interactions?.get(interaction.commandName);
    if (!interact) return;
    else return interact.action(client, interaction);
}


export default main;