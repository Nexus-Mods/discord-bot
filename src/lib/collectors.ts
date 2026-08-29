import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type EmbedBuilder,
    type Message, MessageFlags, type Snowflake,
    type ButtonInteraction, type ChatInputCommandInteraction, type RepliableInteraction,
} from 'discord.js';
import type { Logger } from '../api/logger.js';

/**
 * Wait for the invoking user to press one of the buttons on a message.
 *
 * Replaces seven hand-rolled collectors that each got some of this right and none
 * of it all:
 *
 *  - **None of them filtered by user.** Any member of the channel could press the
 *    buttons on somebody else's search results and steer their command.
 *  - Teardown was inconsistent. Two sites called `ic.first()?.update()` when
 *    `ic.size` was 0, where `first()` is undefined, so the buttons were never
 *    cleared on timeout (B17).
 *  - Timeouts ranged from 30 seconds to an hour, with no stated reason.
 *
 * Resolves to the pressed button's customId, or undefined on timeout. Components
 * are cleared exactly once either way.
 */
export async function awaitButtonChoice(options: {
    /** The message carrying the buttons. */
    message: Message;
    /** Only this user may press. Others get a private nudge. */
    userId: Snowflake;
    /** The interaction to clear components through on timeout. */
    interaction: RepliableInteraction;
    logger: Logger;
    timeoutMs?: number;
}): Promise<string | undefined> {
    const { message, userId, interaction, logger, timeoutMs = 60_000 } = options;

    try {
        const pressed = await message.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: timeoutMs,
            filter: async (i: ButtonInteraction) => {
                if (i.user.id === userId) return true;
                await i.reply({
                    content: 'These buttons belong to someone else\'s command. Run it yourself to use them.',
                    flags: MessageFlags.Ephemeral,
                }).catch(() => undefined);
                return false;
            },
        });

        // deferUpdate acknowledges the press without touching the message, leaving
        // the caller free to edit it however it likes.
        await pressed.deferUpdate().catch(() => undefined);
        await clearComponents(interaction, logger);
        return pressed.customId;
    }
    catch {
        // awaitMessageComponent rejects on timeout rather than resolving.
        await clearComponents(interaction, logger);
        return undefined;
    }
}

/**
 * Remove the components from a reply. Failure here is not worth surfacing - the
 * message may have been deleted, or the interaction token may have expired.
 */
export async function clearComponents(interaction: RepliableInteraction, logger: Logger): Promise<void> {
    await interaction.editReply({ components: [] })
        .catch((err) => logger.debug('Could not clear components', err));
}

/**
 * Post an embed with one numbered button per item and return whichever the user
 * picked, or undefined if they let it time out.
 *
 * searchMods and searchCollections each built this by hand - a button row, an
 * editReply, a collector, then a find() to map the pressed customId back to the
 * item it came from.
 */
export async function presentChoices<T>(options: {
    interaction: ChatInputCommandInteraction;
    embed: EmbedBuilder;
    items: T[];
    /** Must be unique within the set and at most 100 characters. */
    customId: (item: T) => string;
    label: (item: T, index: number) => string;
    logger: Logger;
    timeoutMs?: number;
}): Promise<T | undefined> {
    const { interaction, embed, items, customId, label, logger, timeoutMs } = options;

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        items.map((item, index) => new ButtonBuilder()
            .setCustomId(customId(item))
            .setLabel(label(item, index))
            .setStyle(ButtonStyle.Primary)),
    );

    const message = await interaction.editReply({ embeds: [embed], components: [buttons] }) as Message;
    const chosen = await awaitButtonChoice({ message, userId: interaction.user.id, interaction, logger, timeoutMs });
    if (!chosen) return undefined;

    return items.find((item) => customId(item) === chosen);
}
