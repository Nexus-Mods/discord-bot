import {
    type CommandInteraction, MessageFlags, PermissionsBitField,
    type InteractionDeferReplyOptions,
} from 'discord.js';
import type { Logger } from '@nexusmods/core/logger.js';
import type { DiscordBotUser } from '@nexusmods/account/DiscordBotUser.js';
import { getUserByDiscordId } from '@nexusmods/account/users.js';

/**
 * Deferring the reply, requiring a linked account, and checking permissions - declared on
 * a command's `discordInteraction` export. Commands that do not opt in are unaffected.
 */

export type DeferVisibility = 'public' | 'ephemeral';

/** A fixed visibility, or one decided from the interaction's own options. */
export type DeferOption = DeferVisibility | ((interaction: CommandInteraction) => DeferVisibility);

/** Passed to a command's action as a fourth argument. */
export interface InteractionContext {
    /** Present whenever the command declared `requiresLink`, so the action need not re-check. */
    user?: DiscordBotUser;
}

export function resolveDeferVisibility(defer: DeferOption, interaction: CommandInteraction): DeferVisibility {
    return typeof defer === 'function' ? defer(interaction) : defer;
}

/** One spelling; the 22 commands had seven, two of them the deprecated `ephemeral` option. */
export function deferOptions(visibility: DeferVisibility): InteractionDeferReplyOptions {
    return visibility === 'ephemeral' ? { flags: MessageFlags.Ephemeral } : {};
}

/**
 * Which of the required permissions the member is missing. Empty means allowed.
 * A null memberPermissions means a DM, where guild permissions do not apply.
 */
export function missingPermissions(
    memberPermissions: PermissionsBitField | null,
    required: bigint[],
    options: { isBotOwner?: boolean } = {},
): bigint[] {
    if (!required.length) return [];
    // Bot owners bypass permission checks.
    if (options.isBotOwner) return [];
    if (!memberPermissions) return required;
    return required.filter((permission) => !memberPermissions.has(permission));
}

export function describePermissions(permissions: bigint[]): string {
    return new PermissionsBitField(permissions).toArray().join(', ');
}

/** Whether the caller is configured as a bot owner. */
export function isBotOwner(interaction: CommandInteraction, ownerIDs: string[] | undefined): boolean {
    return !!ownerIDs?.includes(interaction.user.id);
}

export const OWNER_ONLY_MESSAGE = 'This command is restricted to the bot owners.';

/**
 * Lets ONLY an owner through. Guild scoping is not a substitute: `guilds: [BotDemo]`
 * decides where a command is registered, not who may run it - any administrator of that
 * server still can.
 *
 * An empty OWNER_IDS denies everyone rather than allowing everyone.
 */
export function refusedForOwnerOnly(
    interaction: CommandInteraction,
    ownerIDs: string[] | undefined,
    ownerOnly: boolean | undefined,
): boolean {
    return !!ownerOnly && !isBotOwner(interaction, ownerIDs);
}

export const LINK_REQUIRED_MESSAGE =
    'You need to link your Nexus Mods account to use this command. Run **/link** to get started.';

/** Undefined for no link and for a failed lookup alike; gating cannot act on the difference. */
export async function resolveLinkedUser(
    interaction: CommandInteraction,
    logger: Logger,
): Promise<DiscordBotUser | undefined> {
    try {
        return await getUserByDiscordId(interaction.user.id);
    }
    catch (err) {
        logger.warn('Could not look up the linked account', err);
        return undefined;
    }
}
