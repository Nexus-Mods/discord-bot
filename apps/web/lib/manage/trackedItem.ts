import { getSubscribedChannelsForGuild, getSubscribedItems } from '@nexusmods/persistence/subscriptions.js';
import { SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';
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

/** Something that will become a control once this page can save. */
export interface Preference {
    /** The column or config key it maps to. */
    name: string;
    label: string;
    hint: string;
    kind: 'toggle' | 'text';
    value: boolean | string | null;
}

export interface TrackedItemView {
    id: number;
    title: string;
    type: string;
    channelName: string;
    facts: Fact[];
    preferences: Preference[];
    /**
     * Whatever is left in the config blob after the known keys are surfaced above.
     *
     * Shown raw rather than hidden: a feed behaving oddly because of a key nothing
     * renders is a bad afternoon, and the alternative to showing it is pretending the
     * column is empty.
     */
    advanced: Fact[];
}

const asText = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return 'Not set';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

/** The keys the preferences above already account for, per type. */
const SURFACED: Record<string, string[]> = {
    [SubscribedItemType.Game]: ['nsfw', 'sfw', 'show_new', 'show_updates'],
};

function preferencesFor(item: SubscribedItem<SubscribedItemType>): Preference[] {
    const config = (item.config ?? {}) as Record<string, unknown>;

    const common: Preference[] = [
        {
            name: 'crosspost',
            label: 'Publish to followers',
            hint: 'Crosspost each update, if this is an announcement channel.',
            kind: 'toggle',
            value: item.crosspost,
        },
        {
            name: 'compact',
            label: 'Compact posts',
            hint: 'A shorter embed, for busy channels.',
            kind: 'toggle',
            value: item.compact,
        },
        {
            name: 'message',
            label: 'Message',
            hint: 'Posted above each update. Useful for a role mention.',
            kind: 'text',
            value: item.message,
        },
    ];

    // Only a game feed has anything to decide about what it posts; a mod or collection
    // feed posts that one thing, and a user feed posts what that user publishes.
    if (item.type !== SubscribedItemType.Game) return common;

    return [
        {
            name: 'show_new',
            label: 'New uploads',
            hint: 'Post mods the first time they appear.',
            kind: 'toggle',
            value: (config.show_new as boolean | undefined) ?? true,
        },
        {
            name: 'show_updates',
            label: 'Updates',
            hint: 'Post mods when they are updated.',
            kind: 'toggle',
            value: (config.show_updates as boolean | undefined) ?? true,
        },
        {
            name: 'sfw',
            label: 'Safe for work',
            hint: 'Include mods that are not marked adult.',
            kind: 'toggle',
            value: (config.sfw as boolean | undefined) ?? true,
        },
        {
            name: 'nsfw',
            label: 'Adult content',
            hint: 'Include adult mods. The channel must allow them.',
            kind: 'toggle',
            value: (config.nsfw as boolean | undefined) ?? false,
        },
        ...common,
    ];
}

export function viewOf(item: SubscribedItem<SubscribedItemType>, channelName: string): TrackedItemView {
    const config = (item.config ?? {}) as Record<string, unknown>;
    const surfaced = SURFACED[item.type] ?? [];

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

    const advanced = Object.entries(config)
        .filter(([key]) => !surfaced.includes(key))
        .map(([key, value]) => ({ label: key, value: asText(value) }));

    return {
        id: item.id,
        title: item.title,
        type: String(item.type),
        channelName,
        facts,
        preferences: preferencesFor(item),
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
