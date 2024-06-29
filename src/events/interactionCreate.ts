import { 
    InteractionReplyOptions, GuildChannel, CommandInteraction, AutocompleteInteraction 
} from 'discord.js';
import { unexpectedErrorEmbed, logMessage } from '../api/util';
import { DiscordEventInterface, DiscordInteraction, ClientExt } from '../types/DiscordTypes';

const ignoreErrors: string[] = [ 
    'Unknown interaction', 
    'The user aborted a request.' 
];

const main: DiscordEventInterface = {
    name: 'interactionCreate',
    once: false,
    async execute(client: ClientExt, interaction: CommandInteraction) {
        if (!interaction || (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand() && !interaction.isAutocomplete())) return; // Not an interaction we want to handle.

        if (interaction.isAutocomplete()) return handleAutoComplete(client, interaction);

        const interact: DiscordInteraction = client.interactions?.get(interaction.commandName);
        if (!interact) return logMessage('Invalid interaction requested', {name: interaction.commandName, i: client.interactions, commands: await interaction.guild?.commands.fetch()}, true);
        else {
            logMessage('Interaction Triggered', 
            { 
                command: interaction.commandName,
                requestedBy: interaction.user.tag, 
                server: `${interaction.guild?.name} (${interaction.guildId})`,
                channelName: (interaction.channel as GuildChannel)?.name,
            }
            );
            return interact.action(client, interaction).catch(err => {sendUnexpectedError(interaction, (interaction as CommandInteraction), err)});
        }
    }
}

async function handleAutoComplete(client: ClientExt, interaction: AutocompleteInteraction) {
    const command: DiscordInteraction = client.interactions?.get(interaction.commandName);
    if (!command || !command.autocomplete) {
        return logMessage('Invalid command or missing auto-complete', { name: interaction.commandName, autocomplete: !!command.autocomplete }, true);
    }

    try {
        await command.autocomplete(client, interaction);
    }
    catch(err) {
        logMessage('Failed to handle autocomplete', err, true);
    }
}

export async function sendUnexpectedError(interaction: CommandInteraction|undefined, i:CommandInteraction, err:Error):Promise<void> {
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
        return logMessage('Unknown interaction error', { err, inter: interaction.options, ...context }, true);
    }
    else logMessage('Interaction action errored out', { err, interact: interaction.options, ...context }, true);

    if (interaction.replied || interaction.deferred) {
        if (!interaction.ephemeral) await interaction.deleteReply()
        interaction.ephemeral = true;
        interaction.followUp(reply).catch((replyError:Error) => errorReplyCatch(replyError, 'following up'));
    } else {
        interaction.reply(reply).catch((replyError:Error) => errorReplyCatch(replyError, 'replying'));
    }
    function errorReplyCatch(replyError: Error, action: String) {
        logMessage(`Error ${action} to failed interaction`, {replyError, ...context, err}, true);
        if(!ignoreErrors.includes(replyError.toString()) || !ignoreErrors.includes(replyError.message)) process.exit(1);
    }
}



export default main;