import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits } from 'discord-api-types/v10';
import { MANAGE_FEEDS, MANAGE_SETTINGS, describe as describeGuild, has, manageable, toBits } from '@/lib/auth/permissions';

/**
 * The permission check is the portal's whole security boundary, and unlike the slash
 * commands it has no Discord-side gate behind it - /track relies entirely on Discord
 * refusing to dispatch the interaction. This is new enforcement, so it is tested as such.
 */

const guild = (over: Partial<{ id: string; name: string; icon: string | null; owner: boolean; permissions: string }> = {}) => ({
    id: '1', name: 'A server', icon: null, owner: false, permissions: '0', ...over,
});

const MANAGE_CHANNELS = PermissionFlagsBits.ManageChannels.toString();
const MANAGE_GUILD = PermissionFlagsBits.ManageGuild.toString();
const ADMINISTRATOR = PermissionFlagsBits.Administrator.toString();
const SEND_MESSAGES = PermissionFlagsBits.SendMessages.toString();

describe('the permissions the portal uses', () => {
    it('matches the slash commands rather than inventing a rule', () => {
        // /track sets ManageChannels, /settings sets ManageGuild. Gating feeds on
        // ManageGuild would lock out people who can manage feeds today.
        expect(MANAGE_FEEDS).toBe(PermissionFlagsBits.ManageChannels);
        expect(MANAGE_SETTINGS).toBe(PermissionFlagsBits.ManageGuild);
        expect(MANAGE_FEEDS).not.toBe(MANAGE_SETTINGS);
    });
});

describe('has', () => {
    it('grants the exact flag', () => {
        expect(has(guild({ permissions: MANAGE_CHANNELS }), MANAGE_FEEDS)).toBe(true);
    });

    it('refuses an unrelated flag', () => {
        expect(has(guild({ permissions: SEND_MESSAGES }), MANAGE_FEEDS)).toBe(false);
    });

    it('does not let one managed permission imply the other', () => {
        expect(has(guild({ permissions: MANAGE_CHANNELS }), MANAGE_SETTINGS)).toBe(false);
        expect(has(guild({ permissions: MANAGE_GUILD }), MANAGE_FEEDS)).toBe(false);
    });

    it('treats Administrator as everything', () => {
        const admin = guild({ permissions: ADMINISTRATOR });
        expect(has(admin, MANAGE_FEEDS)).toBe(true);
        expect(has(admin, MANAGE_SETTINGS)).toBe(true);
    });

    it('treats the owner as everything, whatever the bitfield says', () => {
        // interactionCreate.ts lets the owner through the same way.
        const owner = guild({ owner: true, permissions: '0' });
        expect(has(owner, MANAGE_FEEDS)).toBe(true);
        expect(has(owner, MANAGE_SETTINGS)).toBe(true);
    });

    it('grants a flag carried alongside others', () => {
        const combined = (PermissionFlagsBits.ManageChannels | PermissionFlagsBits.SendMessages).toString();
        expect(has(guild({ permissions: combined }), MANAGE_FEEDS)).toBe(true);
    });
});

describe('toBits', () => {
    it.each([
        ['absent', undefined],
        ['empty', ''],
        ['not a number', 'all of them'],
        ['a float', '12.5'],
    ])('reads %s as no permissions rather than throwing', (_label, value) => {
        expect(toBits(value as string | undefined)).toBe(0n);
    });

    it('handles values beyond Number.MAX_SAFE_INTEGER', () => {
        // Discord's bitfield is 53+ bits and arrives as a string for exactly this reason.
        const big = '1099511627776';
        expect(toBits(big)).toBe(1099511627776n);
    });
});

describe('manageable', () => {
    it('keeps only the guilds where something can be done, sorted by name', () => {
        const rows = manageable([
            guild({ id: '1', name: 'Zed', permissions: MANAGE_CHANNELS }),
            guild({ id: '2', name: 'Nothing here', permissions: SEND_MESSAGES }),
            guild({ id: '3', name: 'Alpha', permissions: MANAGE_GUILD }),
            guild({ id: '4', name: 'Owned', owner: true, permissions: '0' }),
        ]);

        expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Owned', 'Zed']);
    });

    it('reports the two capabilities separately', () => {
        const [only] = manageable([guild({ permissions: MANAGE_CHANNELS })]);
        expect(only.canManageFeeds).toBe(true);
        expect(only.canManageSettings).toBe(false);
    });

    it('is empty when the user manages nothing', () => {
        expect(manageable([guild({ permissions: SEND_MESSAGES })])).toEqual([]);
    });
});

describe('describe', () => {
    it('carries the identity through unchanged', () => {
        const row = describeGuild(guild({ id: '42', name: 'Named', icon: 'hash', permissions: MANAGE_CHANNELS }));
        expect(row).toMatchObject({ id: '42', name: 'Named', icon: 'hash', canManageFeeds: true });
    });
});
