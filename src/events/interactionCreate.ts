import { 
    InteractionReplyOptions, GuildChannel, CommandInteraction, AutocompleteInteraction, 
    MessageFlags,
    ChatInputCommandInteraction
} from 'discord.js';
import { isTesting, Logger, unexpectedErrorEmbed } from '../api/util';
import { DiscordEventInterface, DiscordInteraction, ClientExt } from '../types/DiscordTypes';

const ignoreErrors: string[] = [ 
    'Unknown interaction', 
    'The user aborted a request.' 
];

const main: DiscordEventInterface = {
    name: 'interactionCreate',
    once: false,
    async execute(client: ClientExt, logger: Logger, interaction: CommandInteraction) {
        if (!interaction || (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand() && !interaction.isAutocomplete())) return; // Not an interaction we want to handle.

        if (interaction.isAutocomplete()) return handleAutoComplete(client, interaction, logger);

        const interact: DiscordInteraction = client.interactions?.get(interaction.commandName);
        if (!interact) return logger.warn('Invalid interaction requested', {name: interaction.commandName, i: client.interactions, commands: await interaction.guild?.commands.fetch()});
        else {
            logger.info('Interaction Triggered', 
            { 
                command: interaction.commandName,
                requestedBy: interaction.user.tag, 
                server: `${interaction.guild?.name} (${interaction.guildId})`,
                channelName: (interaction.channel as GuildChannel)?.name,
            }
            );
            return interact.action(client, interaction, logger).catch(err => {sendUnexpectedError(interaction, (interaction as CommandInteraction), err, logger)});
        }
    }
}

async function handleAutoComplete(client: ClientExt, interaction: AutocompleteInteraction, logger: Logger) {
    const command: DiscordInteraction = client.interactions?.get(interaction.commandName);
    if (!command || !command.autocomplete) {
        return logger.warn('Invalid command or missing auto-complete', { name: interaction.commandName, autocomplete: !!command?.autocomplete, command });
    }

    try {
        await command.autocomplete(client, interaction, logger);
    }
    catch(err) {
        if (!isTesting) logger.warn(`Failed to handle autocomplete: ${(err as Error).message}`, {command: interaction.commandName});
        else logger.debug('Failed to handle autocomplete', {err, command: interaction.commandName});
    }
}

export async function sendUnexpectedError(interaction: CommandInteraction|undefined, i:CommandInteraction, err:Error, logger: Logger):Promise<void> {
    if (!interaction) return;
    const context = {
        server: `${interaction.guild?.name} (${interaction.guildId})`,
        channelName: (interaction.channel as any)?.name,
        requestedBy: interaction.user.tag,
        botVersion: process.env.npm_package_version,
        interaction: !i.isCommand() ? interaction.commandName : interaction.toString(),
        error: err.message || err
    }

    const reply:InteractionReplyOptions  = { embeds: [unexpectedErrorEmbed(err, context)], flags: MessageFlags.Ephemeral};
    if (ignoreErrors.includes(context.error.toString())) {
        return logger.error('Unknown interaction error', { err, inter: (interaction as ChatInputCommandInteraction).options, ...context });
    }
    else logger.warn('Interaction action errored out', { err, interact: (interaction as ChatInputCommandInteraction).options, ...context });

    if (interaction.replied || interaction.deferred) {
        if (!interaction.ephemeral) await interaction.deleteReply()
        interaction.ephemeral = true;
        interaction.followUp(reply).catch((replyError:Error) => errorReplyCatch(replyError, 'following up'));
    } else {
        interaction.reply(reply).catch((replyError:Error) => errorReplyCatch(replyError, 'replying'));
    }
    function errorReplyCatch(replyError: Error, action: String) {
        logger.error(`Error ${action} to failed interaction`, {replyError, ...context, err});
        if(!ignoreErrors.includes(replyError.toString()) || !ignoreErrors.includes(replyError.message)) process.exit(1);
    }
}



export default main;