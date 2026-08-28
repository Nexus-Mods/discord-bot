import { 
    InteractionReplyOptions, GuildChannel, CommandInteraction, AutocompleteInteraction, 
    MessageFlags,
    ChatInputCommandInteraction
} from 'discord.js';
import { isTesting, Logger, unexpectedErrorEmbed } from '../api/util.js';
import { randomUUID } from 'node:crypto';
import { DiscordEventInterface, DiscordInteraction, ClientExt } from '../types/DiscordTypes.js';
import {
    deferOptions, describePermissions, missingPermissions, resolveDeferVisibility,
    resolveLinkedUser, LINK_REQUIRED_MESSAGE, type InteractionContext,
} from '../lib/middleware.js';

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
            return runCommand(client, interact, interaction, logger)
                .catch(async (err) => sendUnexpectedError(interaction, interaction as CommandInteraction, err, logger));
        }
    }
}

/**
 * Run the declarative middleware a command asked for, then the command itself.
 *
 * Deferring, requiring a linked account and checking permissions were previously
 * each command's own problem, which is why the defer was spelled seven different
 * ways and the "you need to link" message had six different wordings. A command that
 * declares none of these behaves exactly as it did before.
 */
async function runCommand(
    client: ClientExt,
    interact: DiscordInteraction,
    interaction: CommandInteraction,
    logger: Logger,
): Promise<void> {
    const ctx: InteractionContext = {};

    if (interact.defer) {
        await interaction.deferReply(deferOptions(resolveDeferVisibility(interact.defer, interaction)));
    }

    if (interact.requiredPermissions?.length) {
        const missing = missingPermissions(interaction.memberPermissions, interact.requiredPermissions);
        if (missing.length) {
            logger.info('Command refused, missing permissions', {
                command: interaction.commandName,
                requestedBy: interaction.user.tag,
                missing: describePermissions(missing),
            });
            await respond(interaction, `You need the following permission(s) to use this command: ${describePermissions(missing)}.`);
            return;
        }
    }

    if (interact.requiresLink) {
        ctx.user = await resolveLinkedUser(interaction, logger);
        if (!ctx.user) {
            await respond(interaction, LINK_REQUIRED_MESSAGE);
            return;
        }
    }

    return interact.action(client, interaction, logger, ctx);
}

/** Reply or edit, depending on whether the command asked us to defer first. */
async function respond(interaction: CommandInteraction, content: string): Promise<void> {
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content });
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
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

    // A short reference the user can quote. The full error is logged against it, so
    // nobody has to paste an internal error message out of an embed to report a bug.
    const errorId = randomUUID().slice(0, 8);

    // Deliberately carries no raw error text: this object is rendered into the embed.
    const context = {
        errorId,
        server: `${interaction.guild?.name} (${interaction.guildId})`,
        channelName: (interaction.channel as any)?.name,
        requestedBy: interaction.user.tag,
        botVersion: process.env.npm_package_version,
        interaction: !i.isCommand() ? interaction.commandName : interaction.toString(),
    }

    const reply:InteractionReplyOptions  = { embeds: [unexpectedErrorEmbed(err, context, errorId)], flags: MessageFlags.Ephemeral};
    if (ignoreErrors.includes(err.message)) {
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
    function errorReplyCatch(replyError: Error, action: string) {
        logger.error(`Error ${action} to failed interaction`, {replyError, ...context, err});
        if(!ignoreErrors.includes(replyError.toString()) && !ignoreErrors.includes(replyError.message)) process.exit(1);
    }
}



export default main;