import { describe, it, expect } from 'vitest';
import { SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';
import type { SubscribedItem } from '@nexusmods/persistence/types/subscriptions.js';
import { viewOf } from '@/lib/manage/trackedItem';
import type { Preference } from '@/lib/manage/trackedItem';
import { configKeysFor, resolveConfig } from '@nexusmods/persistence/types/subscriptionConfig.js';

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

const names = (view: { feedOptions: { name: string }[]; discordOptions: { name: string }[] }) =>
    [...view.feedOptions, ...view.discordOptions].map((p) => p.name);
const byName = (view: { feedOptions: Preference[]; discordOptions: Preference[] }) =>
    Object.fromEntries([...view.feedOptions, ...view.discordOptions].map((p) => [p.name, p.value]));

describe('what each kind of feed can be told to do', () => {
    it('offers a game feed what to include', () => {
        const view = viewOf(item(), 'mods');
        expect(names(view)).toEqual([
            ...configKeysFor(SubscribedItemType.Game).filter((k) => k.promoted).map((k) => k.key),
            'crosspost', 'compact', 'message',
        ]);
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

    it('uses the declared defaults when nothing is stored', () => {
        const view = viewOf(item({ config: {} }), 'mods');
        // Taken from the table, which took them from the feed. show_new is false there.
        expect(byName(view)).toMatchObject({ show_new: false, show_updates: false, sfw: true, nsfw: null });
    });

    it('reads what is actually stored over the defaults', () => {
        const view = viewOf(item({ config: { show_new: false, nsfw: true } }), 'mods');
        expect(byName(view)).toMatchObject({ show_new: false, nsfw: true, show_updates: false });
    });

    it('carries the column values, not just the config', () => {
        const view = viewOf(item({ crosspost: true, message: '<@&123> new mod' }), 'mods');
        expect(byName(view)).toMatchObject({ crosspost: true, compact: true, message: '<@&123> new mod' });
    });
});

describe('the config blob', () => {
    const advancedFor = (over: Record<string, unknown> = {}) =>
        Object.fromEntries(viewOf(item(over), 'mods').advanced.map((e) => [e.key, e]));

    it('lists every key this kind of feed can have, stored or not', async () => {
        // The point of the declared table: an empty config still shows what could be set.
        const advanced = advancedFor({ config: {} });
        const declared = configKeysFor(SubscribedItemType.Game).map((k) => k.key);
        expect(Object.keys(advanced)).toEqual(expect.arrayContaining(declared));
    });

    it('says whether a value was chosen or merely defaulted', async () => {
        // "false because nobody set it" and "false because someone chose it" look the
        // same on screen, and only one is safe to change.
        const advanced = advancedFor({ config: { show_new: false } });
        expect(advanced.show_new).toMatchObject({ value: false, source: 'set' });
        expect(advanced.show_updates).toMatchObject({ value: false, source: 'default' });
    });

    it('calls nsfw inherited rather than inventing a no', async () => {
        // showAdult() returns `config.nsfw ?? channel.nsfw`, so an absent key follows the
        // channel. Reporting it as false would be a lie about what the feed does.
        const advanced = advancedFor({ config: {} });
        expect(advanced.nsfw).toMatchObject({ value: null, source: 'inherited' });
        expect(advanced.nsfw.spec?.inherits).toContain('channel');
    });

    it('shows a key nothing declares rather than hiding it', async () => {
        const advanced = advancedFor({ config: { mystery_option: 'on' } });
        expect(advanced.mystery_option).toMatchObject({ value: 'on', source: 'undeclared', spec: null });
    });

    it('shows a mod feed its stored status, marked read only', async () => {
        const view = viewOf(item({ type: SubscribedItemType.Mod, config: { last_status: 'published' } }), 'mods');
        const status = view.advanced.find((e) => e.key === 'last_status');
        expect(status).toMatchObject({ value: 'published', source: 'set' });
        expect(status?.spec?.readOnly).toBe(true);
    });

    it('survives an item with no config at all', async () => {
        const view = viewOf(item({ config: undefined }), 'mods');
        expect(view.advanced.every((e) => e.source !== 'set')).toBe(true);
        expect(names(view)).toContain('show_new');
    });
});

describe('the declared defaults match the bot', () => {
    // These are read from SubscriptionManager, not chosen. Changing one changes what
    // every item without that key does, which is most of them.
    const byKey = Object.fromEntries(configKeysFor(SubscribedItemType.Game).map((k) => [k.key, k]));

    it.each([
        ['show_new', false],
        ['show_updates', false],
        ['sfw', true],
    ])('defaults %s to %s, as the feed does', (key, expected) => {
        expect(byKey[key].default).toBe(expected);
    });

    it('does not give nsfw a fixed default', () => {
        expect(byKey.nsfw.default).toBeNull();
    });

    it('marks the two new keys as not yet acted on', () => {
        expect(byKey.includeTranslations.notImplemented).toBe(true);
        expect(byKey.includeAIContent.notImplemented).toBe(true);
    });
});

describe('resolveConfig', () => {
    it('gives a user feed nothing to configure', () => {
        expect(resolveConfig(SubscribedItemType.User, {})).toEqual([]);
    });

    it('does not treat an explicit false as absent', () => {
        // `hasOwnProperty`, not a truthiness check: `{ sfw: false }` is a choice.
        const [sfw] = resolveConfig(SubscribedItemType.Game, { sfw: false }).filter((e) => e.key === 'sfw');
        expect(sfw).toMatchObject({ value: false, source: 'set' });
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
        expect(view.discordOptions.find((p) => p.name === 'message')?.value).toBeNull();
    });
});

describe('the two groups', () => {
    it('puts config keys in Feed Options and columns in Discord Options', () => {
        const view = viewOf(item(), 'mods');
        expect(view.feedOptions.map((p) => p.name)).toEqual(
            configKeysFor(SubscribedItemType.Game).filter((k) => k.promoted).map((k) => k.key),
        );
        expect(view.discordOptions.map((p) => p.name)).toEqual(['crosspost', 'compact', 'message']);
    });

    it('never declares a column in the config table', () => {
        // The split is a storage boundary, not a style choice: CONFIG_KEYS describes the
        // JSONB blob. Declaring crosspost there would make the page read a key that does
        // not exist and ignore the column that does.
        const columns = ['crosspost', 'compact', 'message', 'owner', 'title', 'entityid'];
        for (const type of Object.values(SubscribedItemType)) {
            const declared = configKeysFor(type).map((k) => k.key);
            expect(declared.filter((k) => columns.includes(k)), `${type} declares a column`).toEqual([]);
        }
    });

    it('leaves Feed Options empty for a feed with nothing to decide', () => {
        // A mod feed posts that one mod. The page renders no group rather than an empty
        // box under a heading.
        const view = viewOf(item({ type: SubscribedItemType.Mod, config: {} }), 'mods');
        expect(view.feedOptions).toEqual([]);
        expect(view.discordOptions).toHaveLength(3);
    });
});
