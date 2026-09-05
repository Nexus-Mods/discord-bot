import {
    type CommandInteraction, MessageFlags, PermissionsBitField,
    type InteractionDeferReplyOptions,
} from 'discord.js';
import type { Logger } from '@nexusmods/core/logger.js';
import type { DiscordBotUser } from '../api/DiscordBotUser.js';
import { getUserByDiscordId } from '../api/users.js';

/**
 * Cross-cutting concerns every command was implementing for itself: deferring the
 * reply, requiring a linked Nexus Mods account, and checking permissions.
 *
 * Commands opt in declaratively on their `discordInteraction` export. Anything that
 * does not opt in keeps doing exactly what it did before, so this can be adopted a
 * command at a time.
 */

export type DeferVisibility = 'public' | 'ephemeral';

/** A fixed visibility, or one decided from the interaction's own options. */
export type DeferOption = DeferVisibility | ((interaction: CommandInteraction) => DeferVisibility);

/** Passed to a command's action as a fourth argument. */
export interface InteractionContext {
    /**
     * The invoking user's linked Nexus Mods account. Present whenever the command
     * declared `requiresLink: true` - the middleware refuses the command otherwise,
     * so the action does not have to re-check.
     */
    user?: DiscordBotUser;
}

export function resolveDeferVisibility(defer: DeferOption, interaction: CommandInteraction): DeferVisibility {
    return typeof defer === 'function' ? defer(interaction) : defer;
}

/**
 * The 22 commands spelled this seven different ways, two of them still using the
 * deprecated `ephemeral` option rather than message flags.
 */
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
    // Bot owners bypass permission checks. settings.ts carried this rule inline as
    // `ManageGuild || ownerIDs.includes(...)`; it belongs in one place.
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
 * The counterpart to the owner bypass above: `requiredPermissions` lets an owner
 * through a check, this one lets *only* an owner through.
 *
 * Guild scoping is not a substitute. `guilds: [BotDemo]` decides where a command is
 * registered, which keeps it out of sight but is not an authorisation check - any
 * administrator of that server can still run it. For a command that rewrites every
 * credential in the database, "who can see it" and "who can run it" need to be
 * different questions.
 *
 * An empty OWNER_IDS therefore denies everyone rather than allowing everyone, which is
 * the safe direction for a misconfiguration.
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

/**
 * Resolve the linked account for whoever invoked the command. Returns undefined
 * when there is no link, or when the lookup failed - the caller cannot tell those
 * apart, and for gating purposes it does not matter.
 */
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
