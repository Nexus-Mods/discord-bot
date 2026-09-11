import { getSubscribedChannelsForGuild, getSubscribedItems } from '@nexusmods/persistence/subscriptions.js';
import type { ISubscribedItem, SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';
import { channels as guildChannels, guild as fetchGuild } from '@/lib/discordDirectory';

/**
 * Everything the tracking page needs, assembled.
 *
 * Split out of the page so it can be tested. The page is markup plus one call now, and
 * this is one query, two REST calls and a join - which is where the mistakes live: the
 * channel names come from Discord and the subscriptions from the database, and nothing but
 * this function makes them agree.
 *
 * It cannot be tested through the page: rendering a server component needs a React
 * renderer, and the interesting behaviour is not in the JSX. It also cannot be tested
 * against a real database from anywhere but a machine with the credentials, which is the
 * reason step 6 shipped a fixture at all.
 */
export type Row = Pick<ISubscribedItem<SubscribedItemType>, 'id' | 'type' | 'title' | 'entityid' | 'last_update'>
    & { channelName: string };

export interface Tracking {
    guild: string;
    guildImage: string | null;
    subs: Row[];
}

/** Null when there is no such guild, or the bot is not in it - the page redirects to '/'. */
export async function trackingFor(guildId: string): Promise<Tracking | null> {
    const known = await fetchGuild(guildId);
    if (!known) return null;

    const [subscribedChannels, channels] = await Promise.all([
        getSubscribedChannelsForGuild(guildId),
        guildChannels(guildId),
    ]);

    const byId = new Map(channels.map((c) => [c.id, c.name]));

    const subs = (await Promise.all(subscribedChannels.map(async (channel) => {
        // A channel the bot can no longer see still has rows pointing at it, so the name
        // has to have a fallback rather than leaving the column blank.
        const channelName = byId.get(channel.channel_id) ?? 'Unknown Channel';
        const items = await getSubscribedItems(channel);
        return items.map((item) => ({ ...item, channelName }));
    })))
        .flat()
        // Newest first, as Express sorts it.
        .sort((a, b) => b.last_update.getTime() - a.last_update.getTime());

    return { guild: known.name, guildImage: known.iconUrl, subs };
}
