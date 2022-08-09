import { Interaction, MessageContextMenuCommandInteraction, CommandInteraction, UserContextMenuCommandInteraction, InteractionReplyOptions } from 'discord.js';
import { ClientExt } from "../types/util";
import { DiscordInteraction, DiscordInteractionType } from '../types/util';
import { unexpectedErrorEmbed, logMessage } from '../api/util';
import { DiscordEventInterface } from '../types/DiscordTypes';

const ignoreErrors: string[] = [ 
    'Unknown interaction', 
    'The user aborted a request.' 
];

const main: DiscordEventInterface = {
    name: 'interactionCreate',
    once: false,
    async execute(client: ClientExt, i: Interaction) {
        if (!i) return; // Probably a button interaction or something? 
        const interaction = resolveCommandType(i);
        if (!interaction) return;

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
            interact.action(client, interaction).catch(err => {sendUnexpectedError(interaction, i, err)});
        }
    }
}

export async function sendUnexpectedError(interaction:DiscordInteractionType|undefined, i:Interaction, err:Error):Promise<void> {
    if (!interaction) return;
    const context = {
        server: `${interaction.guild?.name} (${interaction.guildId})`,
        channelName: (interaction.channel as any)?.name,
        requestedBy: interaction.user.tag,
        botVersion: process.env.npm_package_version,
        interaction: !i.isCommand() ? interaction.commandName : interaction.toString(),
        error: err.message || err
    }

    const reply:InteractionReplyOptions  = { embeds: [unexpectedErrorEmbed(err, context)], ephemeral: true};
    if (ignoreErrors.includes(context.error.toString())) {
        return logMessage('Unknown interaction error', { err, inter: interaction, ...context }, true);
    }
    else logMessage('Interaction action errored out', { interact: interaction, ...context }), true;

    if (interaction.replied || interaction.deferred) {
        if (!interaction.ephemeral) await interaction.deleteReply()
        interaction.ephemeral = true;
        interaction.followUp(reply).catch((replyError:Error) => errorReplyCatch(replyError, 'following up'));
    } else {
        interaction.reply(reply).catch((replyError:Error) => errorReplyCatch(replyError, 'replying'));
    }
    function errorReplyCatch(replyError: Error, action: String) {
        logMessage(`Error ${action} to failed interaction`, {replyError, ...context, interact: interaction}, true);
        if(!ignoreErrors.includes(replyError.toString()) || !ignoreErrors.includes(replyError.message)) process.exit(1);
    }
}

export function resolveCommandType(interaction: Interaction): DiscordInteractionType|undefined {
    if (interaction.isCommand()) return (interaction as CommandInteraction);
    else if (interaction.isUserContextMenuCommand()) return (interaction as UserContextMenuCommandInteraction);
    else if (interaction.isMessageContextMenuCommand()) return (interaction as MessageContextMenuCommandInteraction);
} 




export default main;