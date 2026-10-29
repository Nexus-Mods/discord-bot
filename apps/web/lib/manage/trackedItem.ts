import { getSubscribedChannelsForGuild, getSubscribedItems } from '@nexusmods/persistence/subscriptions.js';
import type { SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';
import { resolveConfig } from '@nexusmods/persistence/types/subscriptionConfig.js';
import type { ResolvedConfigValue } from '@nexusmods/persistence/types/subscriptionConfig.js';
import type { SubscribedItem } from '@nexusmods/persistence/types/subscriptions.js';
import { channels as guildChannels } from '@/lib/discordDirectory';

/**
 * One tracked item, and what the edit page should show for it.
 *
 * The lookup is scoped to the guild rather than by id alone. An id is a small integer
 * from a shared sequence, so a global lookup would let anyone who can manage one server
 * read the feeds of another by counting - the guild in the URL has to be part of the
 * query, not decoration on it.
 */

export interface Fact {
    label: string;
    value: string;
}

/**
 * Something that will become a control once this page can save.
 *
 * They come in two groups, and the split is not cosmetic - it is where the value lives.
 * Feed options are keys in the `config` blob and are declared in CONFIG_KEYS; Discord
 * options are columns on `subscribeditems`. The columns are expected to move into the
 * blob eventually, at which point they simply become declared keys and the grouping
 * stops being a storage boundary and starts being only a heading.
 */
export interface Preference {
    /** The column or config key it maps to. */
    name: string;
    label: string;
    hint: string;
    kind: 'toggle' | 'text';
    value: boolean | string | null;
    /** True when the item stores a value; false when this is the declared default. */
    isSet?: boolean;
    /** Where an unset value comes from, when it is not a fixed default. */
    inherits?: string;
    /** Stored, but nothing acts on it yet. */
    notImplemented?: boolean;
}

export interface TrackedItemView {
    id: number;
    title: string;
    type: string;
    channelName: string;
    facts: Fact[];
    /** What the feed posts. Config keys, declared in CONFIG_KEYS. */
    feedOptions: Preference[];
    /** How it posts to Discord. Columns on the row, for now. */
    discordOptions: Preference[];
    /**
     * Every config key this kind of feed can have, whether or not it is stored, with
     * where each value came from. Undeclared keys found in the blob are included: a feed
     * behaving oddly because of a key no table mentions is exactly what a declared schema
     * would otherwise hide.
     */
    advanced: ResolvedConfigValue[];
}

const asText = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return 'Not set';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

/**
 * The controls a form should offer.
 *
 * The config half is generated from CONFIG_KEYS rather than written out again here - the
 * labels, hints and defaults all live in one table now, so the form and the feed cannot
 * disagree about what an absent key means.
 */
function feedOptionsFor(item: SubscribedItem<SubscribedItemType>): Preference[] {
    const resolved = resolveConfig(item.type, item.config as Record<string, unknown> | undefined);

    const fromConfig: Preference[] = resolved
        .filter((entry): entry is ResolvedConfigValue & { spec: NonNullable<ResolvedConfigValue['spec']> } => (
            entry.spec !== null && entry.spec.promoted === true
        ))
        .map(({ spec, value, source }) => ({
            name: spec.key,
            label: spec.label,
            hint: spec.hint,
            kind: spec.kind,
            value,
            isSet: source === 'set',
            inherits: spec.inherits,
            notImplemented: spec.notImplemented,
        }));

    return fromConfig;
}

/**
 * The three that live on the row rather than in the blob. Always present, so always set -
 * there is no "unset" state for a boolean column with a value in it.
 */
function discordOptionsFor(item: SubscribedItem<SubscribedItemType>): Preference[] {
    return [
        {
            name: 'crosspost',
            label: 'Publish to followers',
            hint: 'Crosspost each update, if this is an announcement channel.',
            kind: 'toggle',
            value: item.crosspost,
            isSet: true,
        },
        {
            name: 'compact',
            label: 'Compact posts',
            hint: 'A shorter embed, for busy channels.',
            kind: 'toggle',
            value: item.compact,
            isSet: true,
        },
        {
            name: 'message',
            label: 'Message',
            hint: 'Posted above each update. Useful for a role mention.',
            kind: 'text',
            value: item.message,
            isSet: item.message !== null,
        },
    ];
}

export function viewOf(item: SubscribedItem<SubscribedItemType>, channelName: string): TrackedItemView {
    const config = item.config as Record<string, unknown> | undefined;

    const facts: Fact[] = [
        { label: 'Type', value: String(item.type) },
        { label: 'Entity ID', value: asText(item.entityid) },
        { label: 'Channel', value: `#${channelName}` },
        { label: 'Added by', value: item.owner },
        { label: 'Added', value: asText(item.created) },
        { label: 'Last update', value: asText(item.last_update) },
    ];

    // Only worth a line when it is non-zero: a feed with failures is the one thing on
    // this page someone might need to act on.
    if (item.error_count > 0) {
        facts.push({ label: 'Recent errors', value: String(item.error_count) });
    }
    if (item.collectionIds) {
        facts.push({ label: 'Collection', value: `${item.collectionIds.gameDomain}/${item.collectionIds.slug}` });
    }

    const advanced = resolveConfig(item.type, config);

    return {
        id: item.id,
        title: item.title,
        type: String(item.type),
        channelName,
        facts,
        feedOptions: feedOptionsFor(item),
        discordOptions: discordOptionsFor(item),
        advanced,
    };
}

/** Null when there is no such item in this guild - which includes "not in this guild". */
export async function trackedItemFor(guildId: string, itemId: number): Promise<TrackedItemView | null> {
    if (!Number.isInteger(itemId)) return null;

    const [subscribedChannels, channels] = await Promise.all([
        getSubscribedChannelsForGuild(guildId),
        guildChannels(guildId),
    ]);
    const byId = new Map(channels.map((c) => [c.id, c.name]));

    for (const channel of subscribedChannels) {
        const items = await getSubscribedItems(channel);
        const found = items.find((i) => i.id === itemId);
        // A channel the bot can no longer see still has rows pointing at it, so the name
        // needs a fallback rather than leaving the field blank.
        if (found) return viewOf(found, byId.get(channel.channel_id) ?? 'Unknown Channel');
    }

    return null;
}
