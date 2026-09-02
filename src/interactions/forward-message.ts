import {
    ApplicationCommandType, ContextMenuCommandBuilder, MessageReferenceType,
    PermissionFlagsBits, Routes, InteractionContextType,
    type Client, type CommandInteraction, type ContextMenuCommandType,
    type MessageContextMenuCommandInteraction, type Message, type Snowflake,
} from 'discord.js';
import type { DiscordInteraction } from '../types/DiscordTypes.js';
import { KnownDiscordServers, type Logger } from '../api/util.js';

/**
 * Right-click a message and send it to the staff channel.
 *
 * The destination is one fixed channel in one server - FORWARD_CHANNEL_ID - and the
 * command is used from other servers, which is what makes this less trivial than it
 * looks. Two consequences drive the whole implementation:
 *
 * **It cannot use `message.forward()`.** That helper calls `client.channels.resolve()`,
 * which is cache-only, and a channel in a guild belonging to a different shard is not in
 * this shard's cache. It would throw `InvalidType` for the exact case this command
 * exists to serve, and would appear to work in a single-shard test. The REST call below
 * is the same request discord.js would build - `message_reference` with
 * `MessageReferenceType.Forward` - sent through `client.rest`, which has no cache and no
 * shard.
 *
 * **The attribution has to be a second message.** Discord rejects `content` on a
 * forward, so who-sent-this-and-from-where cannot ride along with it. It is posted
 * after, and only after the forward succeeds - a bare attribution line pointing at a
 * message that never arrived is worse than nothing.
 */

/** Where forwarded messages land. Unset means the command reports itself unavailable. */
function destination(): Snowflake | undefined {
    const id = process.env.FORWARD_CHANNEL_ID?.trim();
    return id ? id : undefined;
}

/**
 * The body of the forward request.
 *
 * Exported so it can be tested without a gateway: this is the one part where a wrong
 * field name produces a 400 at the moment someone is trying to report something.
 */
export function forwardBody(message: { id: Snowflake; channelId: Snowflake; guildId: Snowflake | null }) {
    return {
        message_reference: {
            type: MessageReferenceType.Forward,
            message_id: message.id,
            channel_id: message.channelId,
            // Omitted rather than null for a DM, which the guild guard already rules out.
            guild_id: message.guildId ?? undefined,
        },
    };
}

/**
 * The line posted under the forward.
 *
 * The jump link only resolves for staff who are also in the source server, which is
 * often nobody. It is included because when it does work it saves a lot of time, and the
 * ids are spelled out for when it does not - a channel mention from another guild
 * renders as a dead `#unknown`, so the names are written out rather than mentioned.
 */
export function attributionLine(message: Message, forwardedBy: { tag: string; id: Snowflake }): string {
    const guildName = message.guild?.name ?? 'unknown server';
    const channelName = 'name' in message.channel && message.channel.name ? `#${message.channel.name}` : 'a channel';
    const author = `${message.author.tag} (\`${message.author.id}\`)`;
    const jump = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
    return [
        `-# Forwarded by **${forwardedBy.tag}** (\`${forwardedBy.id}\`)`,
        `-# From **${guildName}** · ${channelName} · originally posted by ${author}`,
        `-# <${jump}>`,
    ].join('\n');
}

const discordInteraction: DiscordInteraction = {
    command: new ContextMenuCommandBuilder()
        .setName('Forward to Nexus Mods')
        .setType(ApplicationCommandType.Message as ContextMenuCommandType)
        // Not a DM command: the attribution is built from guild context, and forwarding
        // a DM into a shared staff channel is not a thing anyone should do by accident.
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    public: false,
    // Deliberately not global. Registered globally, every moderator of every server the
    // bot is in could post into one Nexus Mods channel, and `ManageMessages` would be
    // their own server's permission rather than ours. Widening this is one line, and
    // should be a decision rather than a default.
    guilds: [
        KnownDiscordServers.BotDemo,
        KnownDiscordServers.Main,
        KnownDiscordServers.Moderator,
    ],
    requiredPermissions: [PermissionFlagsBits.ManageMessages],
    defer: 'ephemeral',
    action,
};

async function action(client: Client, baseInteraction: CommandInteraction, logger: Logger): Promise<void> {
    const interaction = baseInteraction as MessageContextMenuCommandInteraction;
    const channelId = destination();

    if (!channelId) {
        logger.warn('Forward command used but FORWARD_CHANNEL_ID is not set', { by: interaction.user.tag });
        await interaction.editReply('Forwarding is not configured on this bot. `FORWARD_CHANNEL_ID` is unset.');
        return;
    }

    const message = interaction.targetMessage;

    try {
        await client.rest.post(Routes.channelMessages(channelId), { body: forwardBody(message) });
    }
    catch (err) {
        // 403 and 404 mean the bot cannot see the destination - almost always a wrong id
        // or a bot that was removed from the staff server - and that is worth telling the
        // person plainly rather than as "something went wrong".
        const status = (err as { status?: number }).status;
        if (status === 403 || status === 404) {
            logger.error('Cannot reach the forwarding channel', { channelId, status });
            await interaction.editReply('I cannot post to the forwarding channel. It may have been deleted, or I may have been removed from that server.');
            return;
        }
        logger.warn('Failed to forward message', { err, messageId: message.id, channelId });
        await interaction.editReply(`Could not forward that message: ${(err as Error).message ?? 'unknown error'}`);
        return;
    }

    // Best effort. The forward is the payload; losing the attribution is a degraded
    // result, not a failed one, so it must not turn a delivered message into an error.
    try {
        await client.rest.post(Routes.channelMessages(channelId), {
            body: { content: attributionLine(message, { tag: interaction.user.tag, id: interaction.user.id }) },
        });
    }
    catch (err) {
        logger.warn('Forwarded the message but could not post the attribution line', err);
    }

    logger.info('Message forwarded', {
        by: interaction.user.tag,
        from: { guild: interaction.guildId, channel: message.channelId, message: message.id },
    });
    await interaction.editReply('Forwarded to the Nexus Mods staff channel.');
}

export { discordInteraction };
