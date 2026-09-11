import { describe, it, expect } from 'vitest';
import { MessageFlags, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { CommandInteraction } from 'discord.js';
import {
    deferOptions, describePermissions, missingPermissions, refusedForOwnerOnly, resolveDeferVisibility,
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
            (((i as unknown as { options: { getBoolean: () => boolean | null } }).options.getBoolean()) ?? true)
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

describe('refusedForOwnerOnly', () => {
    const from = (userId: string) => ({ user: { id: userId } }) as unknown as CommandInteraction;

    it('lets a configured owner through', () => {
        expect(refusedForOwnerOnly(from('111'), ['111', '222'], true)).toBe(false);
    });

    it('refuses everyone else, including server administrators', () => {
        // The point of the flag. `guilds: [BotDemo]` decides where a command is
        // registered, not who may run it - any admin of that server can see and invoke
        // it, and for /tokens that would mean rewriting every credential in the
        // database.
        expect(refusedForOwnerOnly(from('999'), ['111', '222'], true)).toBe(true);
    });

    it('refuses everyone when OWNER_IDS is unset or empty', () => {
        // Fails closed. An owner-only command whose owner list went missing must not
        // silently become an everyone-command.
        expect(refusedForOwnerOnly(from('111'), undefined, true)).toBe(true);
        expect(refusedForOwnerOnly(from('111'), [], true)).toBe(true);
    });

    it('does not gate a command that did not ask to be gated', () => {
        expect(refusedForOwnerOnly(from('999'), ['111'], false)).toBe(false);
        expect(refusedForOwnerOnly(from('999'), ['111'], undefined)).toBe(false);
    });

    it('matches on the invoking user, not a substring of the id', () => {
        // includes() on the array, not on a joined string: '11' must not match '111'.
        expect(refusedForOwnerOnly(from('11'), ['111'], true)).toBe(true);
    });
});
