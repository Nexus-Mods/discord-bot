import { getServerById } from '@nexusmods/persistence/servers.js';
import { getConditionsForRole } from '@nexusmods/persistence/server_role_conditions.js';
import type { BotServer } from '@nexusmods/persistence/types/servers.js';
import { channels as guildChannels, roles as guildRoles } from '@/lib/discordDirectory';

/**
 * A guild's settings, with every Discord id already resolved to a name.
 *
 * The page should render what a person recognises. A row holding `channel_news` is a
 * snowflake; what the reader wants is "#announcements", and the only place that join can
 * happen is here, where the database row and Discord's own lists meet. Split out of the
 * page for the same reason lib/tracking.ts was: the mistakes live in the join, and a
 * server component cannot be tested without a React renderer.
 */

export interface SettingValue {
    label: string;
    /** The resolved name, or null when nothing is configured. */
    value: string | null;
    /** The raw id, kept so a deleted channel can still be identified. */
    raw?: string | null;
    /** What this setting does, in one line. */
    hint: string;
}

export interface RoleCondition {
    type: string;
    game: string;
    min: number;
    op: string;
}

export interface GuildSettings {
    settings: SettingValue[];
    /** Conditions on the claimable role; empty when no role is set. */
    conditions: RoleCondition[];
    roleName: string | null;
    /** No row in `servers` yet - the bot writes one the first time it needs to. */
    unconfigured: boolean;
}

/** A configured id that Discord no longer knows: deleted channel, deleted role. */
const missing = (id: string) => `Unknown (${id})`;

export async function settingsFor(guildId: string): Promise<GuildSettings> {
    const [row, channels, roles] = await Promise.all([
        getServerById(guildId),
        guildChannels(guildId),
        guildRoles(guildId),
    ]);

    const channelName = (id?: string | null) => (
        id ? `#${channels.find((c) => c.id === id)?.name ?? missing(id)}` : null
    );
    const roleName = (id?: string | null) => (
        id ? roles.find((r) => r.id === id)?.name ?? missing(id) : null
    );

    const server: Partial<BotServer> = row ?? {};

    const settings: SettingValue[] = [
        {
            label: 'Search filter',
            value: server.game_filter ?? null,
            hint: 'The game that search commands default to in this server.',
        },
        {
            label: 'Mod author role',
            value: roleName(server.role_author),
            raw: server.role_author ?? null,
            hint: 'The role members can claim once they meet the conditions below.',
        }
    ];

    if (server.channel_news) settings.push({
        label: 'News channel (Legacy)',
        value: channelName(server.channel_news),
        raw: server.channel_news ?? null,
        hint: 'Where the Nexus Mods news feed is posted.',
    })

    if (server.channel_nexus) settings.push({
        label: 'Nexus Mods channel',
        value: channelName(server.channel_nexus),
        raw: server.channel_nexus ?? null,
        hint: 'Where the bot posts general Nexus Mods updates.',
    })

    const conditions = server.role_author
        ? (await getConditionsForRole(guildId, server.role_author)).map((c) => ({
            type: c.type, game: c.game, min: c.min, op: c.op,
        }))
        : [];

    return { settings, conditions, roleName: roleName(server.role_author), unconfigured: !row };
}
