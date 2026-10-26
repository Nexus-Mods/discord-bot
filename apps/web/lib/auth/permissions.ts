import { PermissionFlagsBits } from 'discord-api-types/v10';
import type { UserGuild } from '@nexusmods/auth/discordLogin.js';

/**
 * What a signed-in user may do in a given guild.
 *
 * The permissions mirror the slash commands rather than picking a new rule, because the
 * portal sits beside them rather than replacing them:
 *
 *     /track, /untrack   ManageChannels   (interactions/track.ts)
 *     /settings          ManageGuild      (interactions/settings.ts)
 *
 * Gating feeds on ManageGuild would be stricter than the command and would lock out
 * people who can manage feeds today.
 *
 * One thing this deliberately does not do is honour per-guild command permission
 * overrides. A server admin can reassign /track to an arbitrary role in Discord's
 * Integrations settings, and that cannot be seen from a permissions bitfield - reading it
 * is a per-guild API call on every check. The portal uses the default permission and says
 * so rather than pretending to match.
 */

export const MANAGE_FEEDS = PermissionFlagsBits.ManageChannels;
export const MANAGE_SETTINGS = PermissionFlagsBits.ManageGuild;

export interface GuildAccess {
    id: string;
    name: string;
    icon: string | null;
    /** The guild owner, who holds everything regardless of the bitfield. */
    owner: boolean;
    canManageFeeds: boolean;
    canManageSettings: boolean;
}

/**
 * A permissions string that is absent or unparseable reads as zero rather than throwing.
 * The value comes from Discord, but it arrives through the user's own session, and an
 * authorisation check that can throw is an authorisation check that can be skipped.
 */
export function toBits(permissions: string | undefined): bigint {
    if (typeof permissions !== 'string' || permissions === '') return 0n;
    try {
        return BigInt(permissions);
    }
    catch {
        return 0n;
    }
}

/**
 * Administrator implies every other permission, and the owner holds Administrator whether
 * or not the bitfield says so. `interactionCreate.ts` lets the owner through the same way,
 * and diverging from the commands here would be a surprise.
 */
export function has(guild: Pick<UserGuild, 'owner' | 'permissions'>, flag: bigint): boolean {
    if (guild.owner) return true;
    const bits = toBits(guild.permissions);
    if ((bits & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator) return true;
    return (bits & flag) === flag;
}

export function describe(guild: UserGuild): GuildAccess {
    return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner: guild.owner,
        canManageFeeds: has(guild, MANAGE_FEEDS),
        canManageSettings: has(guild, MANAGE_SETTINGS),
    };
}

/** The guilds worth asking Discord about: everywhere the user can do anything here. */
export function manageable(guilds: UserGuild[]): GuildAccess[] {
    return guilds
        .map(describe)
        .filter((g) => g.canManageFeeds || g.canManageSettings)
        .sort((a, b) => a.name.localeCompare(b.name));
}
