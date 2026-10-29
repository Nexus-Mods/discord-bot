import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionFlagsBits } from 'discord-api-types/v10';

/**
 * The per-guild pages. Two things worth pinning: who is refused outright, and who is shown
 * the data but told they cannot change it - a distinction that only exists because the two
 * slash commands behind these tabs require different permissions.
 */

const MANAGE_CHANNELS = PermissionFlagsBits.ManageChannels.toString();
const MANAGE_GUILD = PermissionFlagsBits.ManageGuild.toString();
const SEND_MESSAGES = PermissionFlagsBits.SendMessages.toString();

vi.mock('@nexusmods/core/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const session = vi.fn(async () => ({ id: '1', name: 'Someone', avatar: null, accessToken: 'token' }));
vi.mock('@/lib/auth/session', () => ({ currentSession: () => session() }));

const userGuilds = vi.fn(async () => [] as unknown[]);
vi.mock('@nexusmods/auth/discordLogin.js', () => ({ fetchUserGuilds: () => userGuilds() }));

vi.mock('@/lib/discordDirectory', () => ({
    guild: vi.fn(async (id: string) => ({ id, name: 'A server', iconUrl: null })),
    channels: vi.fn(async () => [{ id: 'c1', name: 'announcements' }]),
    roles: vi.fn(async () => [{ id: 'r1', name: 'Mod Author', colour: 0 }]),
}));

const getServerById = vi.fn(async () => undefined as unknown);
vi.mock('@nexusmods/persistence/servers.js', () => ({ getServerById: () => getServerById() }));

const getConditionsForRole = vi.fn(async () => [] as unknown[]);
vi.mock('@nexusmods/persistence/server_role_conditions.js', () => ({
    getConditionsForRole: () => getConditionsForRole(),
}));

const { guildAccess, forgetGuildList } = await import('@/lib/auth/guilds');
const { settingsFor } = await import('@/lib/manage/server');

const guild = (over: Record<string, unknown> = {}) => ({
    id: 'g1', name: 'A server', icon: null, owner: false, permissions: MANAGE_CHANNELS, ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    // The guild list is cached per user for a minute, on globalThis - which is the point.
    // Tests share a process, so each starts from an empty cache.
    forgetGuildList('1');
    session.mockResolvedValue({ id: '1', name: 'Someone', avatar: null, accessToken: 'token' });
    getServerById.mockResolvedValue(undefined as never);
    getConditionsForRole.mockResolvedValue([]);
});

describe('guildAccess', () => {
    it('reports the two permissions separately, so each tab can gate itself', async () => {
        userGuilds.mockResolvedValue([guild({ permissions: MANAGE_CHANNELS })]);

        const { guild: access } = await guildAccess('g1');
        expect(access).toMatchObject({ canManageFeeds: true, canManageSettings: false });
    });

    it('refuses a guild the visitor manages nothing in', async () => {
        userGuilds.mockResolvedValue([guild({ permissions: SEND_MESSAGES })]);
        expect(await guildAccess('g1')).toEqual({ guild: null, unavailable: false });
    });

    it('refuses a guild the visitor is not in at all', async () => {
        userGuilds.mockResolvedValue([guild({ id: 'mine' })]);
        // Null rather than a message: distinguishing "no such server" from "not yours"
        // would confirm to an outsider which servers this bot is in.
        expect(await guildAccess('someone-elses')).toEqual({ guild: null, unavailable: false });
    });

    it('says "could not ask" rather than "not yours" when Discord refuses', async () => {
        // The bug this separates out: GET /users/@me/guilds allows about one request a
        // second, the rail prefetched a route per server, and every 429 was read as a
        // permission denial and answered with a 404.
        userGuilds.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }));

        expect(await guildAccess('g1')).toEqual({ guild: null, unavailable: true });
    });

    it('lets someone with only Manage Server through, for the settings tab', async () => {
        userGuilds.mockResolvedValue([guild({ permissions: MANAGE_GUILD })]);

        const { guild: access } = await guildAccess('g1');
        expect(access).toMatchObject({ canManageFeeds: false, canManageSettings: true });
    });
});

describe('settingsFor', () => {
    it('resolves ids to names a person recognises', async () => {
        getServerById.mockResolvedValue({
            id: 'g1', official: false, server_owner: '1',
            channel_news: 'c1', role_author: 'r1', game_filter: 'stardewvalley',
        } as never);

        const { settings, roleName, unconfigured } = await settingsFor('g1');
        expect(unconfigured).toBe(false);
        expect(settings.find((s) => s.label === 'News channel (Legacy)')?.value).toBe('#announcements');
        expect(settings.find((s) => s.label === 'Mod author role')?.value).toBe('Mod Author');
        expect(settings.find((s) => s.label === 'Search filter')?.value).toBe('stardewvalley');
        expect(roleName).toBe('Mod Author');
    });

    it('says a configured channel is unknown rather than rendering a snowflake', async () => {
        // A deleted channel still has a row pointing at it. "Unknown (123)" is something
        // an admin can act on; a bare id is not.
        getServerById.mockResolvedValue({
            id: 'g1', official: false, server_owner: '1', channel_news: '999',
        } as never);

        const { settings } = await settingsFor('g1');
        expect(settings.find((s) => s.label === 'News channel (Legacy)')?.value).toBe('#Unknown (999)');
    });

    it('reports an unconfigured server without inventing values', async () => {
        const { settings, unconfigured, conditions } = await settingsFor('g1');
        expect(unconfigured).toBe(true);
        expect(settings.every((s) => s.value === null)).toBe(true);
        expect(conditions).toEqual([]);
    });

    it('does not look up role conditions when no role is set', async () => {
        await settingsFor('g1');
        expect(getConditionsForRole).not.toHaveBeenCalled();
    });

    it('carries the role conditions through when there is a role', async () => {
        getServerById.mockResolvedValue({ id: 'g1', official: false, server_owner: '1', role_author: 'r1' } as never);
        getConditionsForRole.mockResolvedValue([
            { id: 1, server_id: 'g1', role_id: 'r1', type: 'modDownloads', game: 'skyrim', min: 1000, op: 'AND' },
        ]);

        const { conditions } = await settingsFor('g1');
        expect(conditions).toEqual([{ type: 'modDownloads', game: 'skyrim', min: 1000, op: 'AND' }]);
    });
});

describe('navigation cost', () => {
    /** A rule that reads its own documentation as a violation is a bad rule. */
    const stripComments = (source: string) => source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

    const read = async (file: string) => {
        const { readFileSync } = await import('node:fs');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
        return readFileSync(path.join(root, file), 'utf8');
    };

    it('switches tabs with next/link, so the rail is not rebuilt', async () => {
        // A plain anchor here is a full navigation: the manage layout re-runs and the
        // server list is fetched again for a change of panel.
        const tabs = await read('components/Tabs.tsx');
        expect(tabs).toContain("from 'next/link'");
        expect(tabs).toContain('<Link');
        expect(tabs).not.toContain('<a ');
    });

    it('switches server with next/link too, so the rail is not rebuilt', async () => {
        // A full navigation here rebuilt the rail, re-asked Discord, and flashed the
        // unscoped /manage skeleton on the way past.
        const rail = await read('components/RailLinks.tsx');
        expect(rail).toContain("from 'next/link'");
        expect(rail).toContain('<Link');
    });

    it('shows the first tab at the bare guild path rather than redirecting', async () => {
        // Comments stripped: the file explains in prose why it no longer redirects, and
        // saying the word is not doing it. The same trap routeSegments documents.
        const index = stripComments(await read('app/manage/[guildId]/page.tsx'));
        expect(index).not.toContain('redirect');
        expect(index).toContain('TrackedPanel');

        // Both routes render the one panel, so they cannot drift apart.
        const tracked = await read('app/manage/[guildId]/tracked/page.tsx');
        expect(tracked).toContain('TrackedPanel');
    });

    it('treats "no segment" as the first tab, so the underline is never blank', async () => {
        const tabs = await read('components/Tabs.tsx');
        expect(tabs).toContain('useSelectedLayoutSegment() ?? tabs[0]?.segment');
    });

    it('has a loading boundary inside the guild segment, not above it', async () => {
        const { existsSync } = await import('node:fs');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');

        // Inside: the tab swap commits immediately and the panel streams.
        expect(existsSync(path.join(app, 'manage', '[guildId]', 'loading.tsx'))).toBe(true);
        // Above: it would wrap the guild layout, so notFound() would land after a 200 had
        // already been flushed - and it flashed an index-shaped skeleton between servers.
        expect(existsSync(path.join(app, 'manage', 'loading.tsx'))).toBe(false);
    });
});

describe('client components and the environment', () => {
    /**
     * A client component reading process.env is a hydration error waiting to happen: the
     * server has the value and the browser does not, so the two renders disagree. Next
     * only exposes NEXT_PUBLIC_* to the browser.
     *
     * This cost an afternoon once - the rail built its invite URL from
     * DISCORD_CLIENT_ID, and the client rendered client_id= with nothing after it.
     */
    it('do not read process.env', async () => {
        const { readFileSync, readdirSync, statSync } = await import('node:fs');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

        const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
            const full = path.join(dir, entry);
            if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : walk(full);
            return /\.tsx?$/.test(full) ? [full] : [];
        });

        const offenders: string[] = [];
        let clientComponents = 0;
        for (const file of [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components'))]) {
            const source = readFileSync(file, 'utf8');
            if (!/^\s*['"]use client['"]/m.test(source)) continue;
            clientComponents += 1;
            const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
            // NEXT_PUBLIC_ is inlined at build time and is safe.
            if (/process\.env\.(?!NEXT_PUBLIC_)/.test(code)) offenders.push(path.relative(root, file));
        }

        // A walk that finds no client components agrees with any rule.
        expect(clientComponents).toBeGreaterThan(0);
        expect(offenders, 'reads process.env in the browser').toEqual([]);
    });
});
