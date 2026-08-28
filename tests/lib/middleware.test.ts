import { describe, it, expect } from 'vitest';
import { MessageFlags, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import {
    deferOptions, describePermissions, missingPermissions, resolveDeferVisibility,
} from '../../src/lib/middleware.js';

describe('deferOptions', () => {
    it('uses message flags rather than the deprecated ephemeral option', () => {
        // Two commands were still passing { ephemeral: boolean }, deprecated in
        // discord.js v14.
        expect(deferOptions('ephemeral')).toEqual({ flags: MessageFlags.Ephemeral });
        expect('ephemeral' in deferOptions('ephemeral')).toBe(false);
    });

    it('sends no flags for a public defer', () => {
        expect(deferOptions('public')).toEqual({});
    });
});

describe('resolveDeferVisibility', () => {
    const interactionWith = (value: boolean | null) => ({
        options: { getBoolean: () => value },
    }) as unknown as CommandInteraction;

    it('passes a fixed visibility straight through', () => {
        expect(resolveDeferVisibility('ephemeral', interactionWith(null))).toBe('ephemeral');
        expect(resolveDeferVisibility('public', interactionWith(null))).toBe('public');
    });

    it('lets a command decide from its own options', () => {
        const fromOption = (i: CommandInteraction) =>
            ((i.options as unknown as { getBoolean: () => boolean | null }).getBoolean() ?? true)
                ? 'ephemeral' as const
                : 'public' as const;

        expect(resolveDeferVisibility(fromOption, interactionWith(true))).toBe('ephemeral');
        expect(resolveDeferVisibility(fromOption, interactionWith(false))).toBe('public');
        // Unset should fall back to the command's default, not to public.
        expect(resolveDeferVisibility(fromOption, interactionWith(null))).toBe('ephemeral');
    });
});

describe('missingPermissions', () => {
    const held = (...perms: bigint[]) => new PermissionsBitField(perms);

    it('is empty when nothing is required', () => {
        expect(missingPermissions(held(), [])).toEqual([]);
        expect(missingPermissions(null, [])).toEqual([]);
    });

    it('is empty when the member holds everything required', () => {
        expect(missingPermissions(
            held(PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageChannels),
            [PermissionFlagsBits.ManageGuild],
        )).toEqual([]);
    });

    it('reports only what is missing', () => {
        expect(missingPermissions(
            held(PermissionFlagsBits.ManageGuild),
            [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.Administrator],
        )).toEqual([PermissionFlagsBits.Administrator]);
    });

    it('treats Administrator as holding everything, as Discord does', () => {
        expect(missingPermissions(
            held(PermissionFlagsBits.Administrator),
            [PermissionFlagsBits.ManageGuild],
        )).toEqual([]);
    });

    it('refuses in a DM, where guild permissions do not exist', () => {
        // memberPermissions is null outside a guild. Failing open here would let a
        // permission-gated command run unguarded in DMs.
        expect(missingPermissions(null, [PermissionFlagsBits.ManageGuild]))
            .toEqual([PermissionFlagsBits.ManageGuild]);
    });
});

describe('describePermissions', () => {
    it('names permissions in a form a user can act on', () => {
        expect(describePermissions([PermissionFlagsBits.ManageGuild])).toBe('ManageGuild');
        expect(describePermissions([PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageChannels]))
            .toContain('ManageChannels');
    });
});
