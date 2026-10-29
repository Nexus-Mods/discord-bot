import { SubscribedItemType } from './subscriptions.js';

/**
 * What can live in a subscribed item's `config` blob, declared rather than discovered.
 *
 * The blob is JSONB, so a key is only there if something wrote it. Before this existed,
 * every reader invented its own answer for an absent key - `?? false` in the feed,
 * `?? true` in the web app's form - and the two could disagree without anyone noticing.
 * One table, and both sides read the same defaults.
 *
 * IT MUST MATCH WHAT THE BOT ACTUALLY DOES. The defaults below were taken from
 * SubscriptionManager, not chosen: `show_new` is false because line 765 filters on
 * `config?.show_new ?? false`, and a feed with no key posts nothing. Changing a default
 * here changes what every item without that key does, which is most of them.
 */

export interface ConfigKeySpec {
    /** The key as it is stored in the blob. */
    key: string;
    label: string;
    hint: string;
    kind: 'toggle';
    /**
     * What the bot behaves as if the value were, when the key is absent.
     *
     * Null means it is not a fixed value - see `inherits` for where it comes from
     * instead. A page should say so rather than inventing a yes or a no.
     */
    default: boolean | null;
    /** Where an absent value comes from, in words, when `default` is null. */
    inherits?: string;
    /** Rendered as a first-class control, rather than only in the advanced list. */
    promoted?: boolean;
    /** Written by the bot to track its own progress. Never a preference. */
    readOnly?: boolean;
    /** Declared and stored, but nothing reads it yet. */
    notImplemented?: boolean;
}

/**
 * Game feeds, fully worked as the example to copy.
 *
 * The order is the order a form should show them: what to post, then what to include.
 */
const GAME_KEYS: ConfigKeySpec[] = [
    {
        key: 'show_new',
        label: 'New uploads',
        hint: 'Post mods the first time they appear.',
        kind: 'toggle',
        // SubscriptionManager:765 - `config?.show_new ?? false`. An item with no key is
        // not in the new-mods query at all.
        default: false,
        promoted: true,
    },
    {
        key: 'show_updates',
        label: 'Updates',
        hint: 'Post mods when they are updated.',
        kind: 'toggle',
        // SubscriptionManager:783, the same shape.
        default: false,
        promoted: true,
    },
    {
        key: 'sfw',
        label: 'Safe for work',
        hint: 'Include mods that are not marked adult.',
        kind: 'toggle',
        // SubscriptionManager:821 only excludes non-adult mods when sfw is explicitly
        // false, so an absent key includes them.
        default: true,
        promoted: true,
    },
    {
        key: 'nsfw',
        label: 'Adult content',
        hint: 'Include adult mods. The channel must allow them.',
        kind: 'toggle',
        // Not false: showAdult() returns `config.nsfw ?? channel.nsfw`, so an absent key
        // follows the channel rather than meaning no.
        default: null,
        inherits: "the channel's age rating",
        promoted: true,
    },
    {
        key: 'includeTranslations',
        label: 'Translations',
        hint: 'Include mods that are translations of other mods.',
        kind: 'toggle',
        default: false,
        promoted: true,
        notImplemented: false,
    },
    {
        key: 'includeAIContent',
        label: 'AI generated content',
        hint: 'Include mods flagged as containing AI generated content.',
        kind: 'toggle',
        default: true,
        promoted: true,
        notImplemented: false,
    },
];

/** Mod and collection feeds store where the bot got to, which is not a preference. */
const STATUS_KEY: ConfigKeySpec = {
    key: 'last_status',
    label: 'Last seen status',
    hint: 'The status the bot last saw, so it can tell what changed.',
    kind: 'toggle',
    default: null,
    inherits: 'nothing - the bot writes it after the first check',
    readOnly: true,
};

export const CONFIG_KEYS: Record<SubscribedItemType, ConfigKeySpec[]> = {
    [SubscribedItemType.Game]: GAME_KEYS,
    [SubscribedItemType.Mod]: [STATUS_KEY],
    [SubscribedItemType.Collection]: [STATUS_KEY],
    // A user feed posts what that user publishes. There is nothing to configure.
    [SubscribedItemType.User]: [],
};

export function configKeysFor(type: SubscribedItemType): ConfigKeySpec[] {
    return CONFIG_KEYS[type] ?? [];
}

/** Where a value came from, which is worth showing: a default is not a choice. */
export type ValueSource = 'set' | 'default' | 'inherited' | 'undeclared';

export interface ResolvedConfigValue {
    spec: ConfigKeySpec | null;
    key: string;
    value: boolean | string | null;
    source: ValueSource;
}

/**
 * Every declared key for this type, plus anything in the blob that nothing declares.
 *
 * The undeclared ones matter: a feed behaving oddly because of a key no table mentions is
 * exactly the case a declared schema would otherwise hide.
 */
export function resolveConfig(
    type: SubscribedItemType,
    config: Record<string, unknown> | undefined | null,
): ResolvedConfigValue[] {
    const stored = (config ?? {}) as Record<string, unknown>;
    const specs = configKeysFor(type);

    const declared: ResolvedConfigValue[] = specs.map((spec) => {
        if (Object.prototype.hasOwnProperty.call(stored, spec.key)) {
            return { spec, key: spec.key, value: stored[spec.key] as boolean | string | null, source: 'set' };
        }
        return {
            spec,
            key: spec.key,
            value: spec.default,
            source: spec.default === null ? 'inherited' : 'default',
        };
    });

    const known = new Set(specs.map((s) => s.key));
    const undeclared: ResolvedConfigValue[] = Object.keys(stored)
        .filter((key) => !known.has(key))
        .map((key) => ({ spec: null, key, value: stored[key] as boolean | string | null, source: 'undeclared' }));

    return [...declared, ...undeclared];
}
