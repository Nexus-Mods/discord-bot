import { describe, it, expect } from 'vitest';
import { SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';
import type { SubscribedItem } from '@nexusmods/persistence/types/subscriptions.js';
import { viewOf } from '@/lib/manage/trackedItem';

/**
 * What the edit page offers depends on what kind of feed it is, and the config blob is
 * the part most likely to drift - the columns it superseded are still in the table.
 */

const base = {
    id: 7,
    parent: 1,
    title: 'Stardew Valley',
    entityid: 'stardewvalley',
    owner: '1234567890',
    last_update: new Date('2026-10-01T00:00:00Z'),
    created: new Date('2026-09-01T00:00:00Z'),
    crosspost: false,
    compact: true,
    message: null,
    error_count: 0,
};

const item = (over: Record<string, unknown> = {}) => (
    { ...base, type: SubscribedItemType.Game, config: {}, ...over } as unknown as SubscribedItem<SubscribedItemType>
);

const names = (view: { preferences: { name: string }[] }) => view.preferences.map((p) => p.name);

describe('what each kind of feed can be told to do', () => {
    it('offers a game feed what to include', () => {
        const view = viewOf(item(), 'mods');
        expect(names(view)).toEqual(['show_new', 'show_updates', 'sfw', 'nsfw', 'crosspost', 'compact', 'message']);
    });

    it.each([
        ['a mod', SubscribedItemType.Mod],
        ['a collection', SubscribedItemType.Collection],
        ['a user', SubscribedItemType.User],
    ])('offers %s feed only the posting options', (_label, type) => {
        // There is nothing to filter: the feed posts that one thing, or what that user
        // publishes. Offering "show new" would be a control that does nothing.
        const view = viewOf(item({ type, config: {} }), 'mods');
        expect(names(view)).toEqual(['crosspost', 'compact', 'message']);
    });

    it('defaults a game feed to showing everything safe', () => {
        const view = viewOf(item({ config: {} }), 'mods');
        const byName = Object.fromEntries(view.preferences.map((p) => [p.name, p.value]));
        expect(byName).toMatchObject({ show_new: true, show_updates: true, sfw: true, nsfw: false });
    });

    it('reads what is actually stored over the defaults', () => {
        const view = viewOf(item({ config: { show_new: false, nsfw: true } }), 'mods');
        const byName = Object.fromEntries(view.preferences.map((p) => [p.name, p.value]));
        expect(byName).toMatchObject({ show_new: false, nsfw: true, show_updates: true });
    });

    it('carries the column values, not just the config', () => {
        const view = viewOf(item({ crosspost: true, message: '<@&123> new mod' }), 'mods');
        const byName = Object.fromEntries(view.preferences.map((p) => [p.name, p.value]));
        expect(byName).toMatchObject({ crosspost: true, compact: true, message: '<@&123> new mod' });
    });
});

describe('the config blob', () => {
    it('does not repeat a key that already has a control', () => {
        const view = viewOf(item({ config: { nsfw: true, show_new: false } }), 'mods');
        expect(view.advanced).toEqual([]);
    });

    it('shows a key nothing renders yet rather than hiding it', () => {
        // A feed behaving oddly because of a key no page displays is a bad afternoon.
        const view = viewOf(item({ config: { nsfw: true, mystery_option: 'on' } }), 'mods');
        expect(view.advanced).toEqual([{ label: 'mystery_option', value: 'on' }]);
    });

    it('shows a mod feed its stored status, which has no control at all', () => {
        const view = viewOf(item({ type: SubscribedItemType.Mod, config: { last_status: 'published' } }), 'mods');
        expect(view.advanced).toEqual([{ label: 'last_status', value: 'published' }]);
    });

    it('survives an item with no config', () => {
        const view = viewOf(item({ config: undefined }), 'mods');
        expect(view.advanced).toEqual([]);
        expect(names(view)).toContain('show_new');
    });

    it('renders a nested value rather than [object Object]', () => {
        const view = viewOf(item({ config: { odd: { a: 1 } } }), 'mods');
        expect(view.advanced).toEqual([{ label: 'odd', value: '{"a":1}' }]);
    });
});

describe('the facts panel', () => {
    it('stays quiet about errors when there are none', () => {
        expect(viewOf(item(), 'mods').facts.map((f) => f.label)).not.toContain('Recent errors');
    });

    it('calls out a failing feed, which is the one thing worth acting on', () => {
        const view = viewOf(item({ error_count: 3 }), 'mods');
        expect(view.facts).toContainEqual({ label: 'Recent errors', value: '3' });
    });

    it('names the channel it posts to', () => {
        expect(viewOf(item(), 'mod-updates').facts).toContainEqual({ label: 'Channel', value: '#mod-updates' });
    });

    it('shows an unset message as "Not set" rather than blank', () => {
        const view = viewOf(item({ message: null }), 'mods');
        expect(view.preferences.find((p) => p.name === 'message')?.value).toBeNull();
    });
});
