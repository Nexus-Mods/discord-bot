import type { Snowflake } from 'discord.js';
import { type ISubscribedChannel, type ISubscribedItemUnionType, SubscribedChannel, SubscribedItem, type SubscribedItemType } from '../types/subscriptions.js';
import { query } from './dbConnect.js';

import { DatabaseError } from './errors.js';

// CHANNEL HANDLERS

/**
 * Operations that used to be methods on SubscribedChannel.
 *
 * They lived there because it reads well - channel.subscribe(...) - but it made the
 * model import this module while this module constructs the model, which is the import
 * cycle 3.6 left behind. Storage depends on the model; the model depends on nothing.
 */
async function loadSubscribedChannel(
    c: ISubscribedChannel,
    items: SubscribedItem<SubscribedItemType>[] = [],
): Promise<SubscribedChannel> {
    if (items.length === 0) items = await getSubscriptionsByChannel(c.guild_id, c.channel_id);
    return new SubscribedChannel(c, items);
}

/** Cached on the channel after the first call, as it was when this was a method. */
async function getSubscribedItems(
    channel: SubscribedChannel,
    skipCache: boolean = false,
): Promise<SubscribedItem<SubscribedItemType>[]> {
    if (!channel.items.length || skipCache) {
        // eslint-disable-next-line require-atomic-updates
        channel.items = await getSubscriptionsByChannel(channel.guild_id, channel.channel_id);;
    }
    return channel.items;
}

async function subscribeChannelTo(
    channel: SubscribedChannel,
    data: NewSubscriptionData,
): Promise<SubscribedItem<SubscribedItemType>> {
    const newSub = await createSubscription(channel.id, data);
    channel.items.push(newSub);
    return newSub;
}

async function updateChannelSubscription(
    channel: SubscribedChannel,
    id: number,
    data: NewSubscriptionData,
): Promise<SubscribedItem<SubscribedItemType>> {
    const updatedSub = await updateSubscription(id, channel.id, data);
    const index = channel.items.findIndex((i) => i.id === id);
    if (index !== -1) channel.items[index] = updatedSub;
    else channel.items.push(updatedSub);
    return updatedSub;
}


async function getSubscribedChannels(): Promise<SubscribedChannel[]> {
    try {
        const data = await query<ISubscribedChannel>(
            'SELECT * FROM SubscribedChannels',
            []
        );
        const subs = await getAllSubscriptions()
        const promises = data.rows.map(async r => loadSubscribedChannel(r, subs.filter(s => s.parent === r.id)));
        const channels = await Promise.all(promises);
        
        return channels;

    }
    catch(err) {
        throw new DatabaseError('Failed to fetch subscribed channels.', { cause: err });
    }
}
async function getSubscribedChannelsForGuild(guild: Snowflake): Promise<SubscribedChannel[]> {
    try {
        const data = await query<ISubscribedChannel>(
            'SELECT * FROM SubscribedChannels WHERE guild_id=$1',
            [guild]
        );
        if (data.rows.length === 0) return [];
        else {
            const channels = Promise.all(
                data.rows.map(async (r) => loadSubscribedChannel(r))
            )
            return (await channels).filter(c => c);
        }

    }
    catch(err) {
        throw new DatabaseError('Failed to fetch subscribed channels for guild.', { cause: err });
    }

}

async function getSubscribedChannel(guild: Snowflake, channel: Snowflake): Promise<SubscribedChannel | undefined> {
    try {
        const data = await query<ISubscribedChannel>(
            'SELECT * FROM SubscribedChannels WHERE guild_id=$1 AND channel_id=$2',
            [guild, channel]
        );
        if (data.rows.length === 0) return undefined;
        else return await loadSubscribedChannel(data.rows[0]);

    }
    catch(err) {
        throw new DatabaseError('Failed to fetch subscribed channel.', { cause: err });
    }
}

async function createSubscribedChannel(c: Omit<ISubscribedChannel, 'id' | 'created' | 'last_update'>): Promise<SubscribedChannel> {
    try {
        const data = await query<ISubscribedChannel>(
            `INSERT INTO SubscribedChannels (guild_id, channel_id, webhook_id, webhook_token)
                VALUES ($1, $2, $3, $4) RETURNING *`,
            [c.guild_id, c.channel_id, c.webhook_id, c.webhook_token]
        );
        return new SubscribedChannel(data.rows[0]);
    }
    catch(err) {
        throw new DatabaseError('Failed to create subscribed channel.', { cause: err });
    }
}

async function updateSubscribedChannel(c: ISubscribedChannel, date: Date): Promise<SubscribedChannel> {
    try {
        const data = await query<ISubscribedChannel>(
            `UPDATE SubscribedChannels SET last_update=$1
                WHERE id=$2 RETURNING *`,
            [date, c.id]
        );
        return new SubscribedChannel(data.rows[0]);
    }
    catch(err) {
        throw new DatabaseError('Failed to update subscribed channel.', { cause: err });
    }
}

async function deleteSubscribedChannel(c: ISubscribedChannel): Promise<void> {
    try {
        await query<ISubscribedChannel>(
            `WITH deleted AS (
                DELETE FROM SubscribedChannels WHERE id=$1 RETURNING id
            )
            DELETE FROM SubscribedItems WHERE parent IN (SELECT id FROM deleted)`,
            [c.id]
        );
        return;
    }
    catch(err) {
        throw new DatabaseError('Failed to delete subscribed channel.', { cause: err });
    }
}

async function totalItemsInGuild(guild: Snowflake): Promise<number> {
    try {
        const result = await query(
            `SELECT COALESCE(SUM(si.item_count), 0) AS tracked_items_for_guild
            FROM (
                SELECT COUNT(*) AS item_count
                FROM SubscribedItems si
                WHERE si.parent IN (
                    SELECT id FROM SubscribedChannels WHERE guild_id = $1
                )
            ) si;`,
            [guild]
        );
        if (result.rows.length === 0) return 0;
        return parseInt(result.rows[0].tracked_items_for_guild, 10);

    }
    catch(err) {
        throw new DatabaseError('Failed to fetch total items in guild.', { cause: err });
    }

}

// SUBSCRIBED ITEM HANDLERS

async function getAllSubscriptions(): Promise<SubscribedItem<SubscribedItemType>[]> {
    try {
        const data = await query<ISubscribedItemUnionType>(
            'SELECT * FROM SubscribedItems',
            []
        );
        return data.rows.map(r => new SubscribedItem(r));

    }
    catch(err) {
        throw new DatabaseError('Failed to fetch all subscribed items.', { cause: err });
    }

}

async function getCountOfSubscriptions(): Promise<number> {
    try {
        const data = await query<{ count: number }>(
            'SELECT COUNT(*) FROM SubscribedItems',
            []
        );
        return Number(data.rows[0].count);

    }
    catch(err) {
        throw new DatabaseError('Failed to fetch count of all subscribed items.', { cause: err });
    }

}

async function getSubscriptionsByChannel(guild: Snowflake, channel: Snowflake): Promise<SubscribedItem<SubscribedItemType>[]> {
    try {
        const data = await query<ISubscribedItemUnionType>(
            `SELECT si.*
            FROM SubscribedItems si
            JOIN SubscribedChannels sc ON si.parent = sc.id
            WHERE sc.guild_id = $1
            AND sc.channel_id = $2;`,
            [guild, channel]
        ); 
        return data.rows.map(r => new SubscribedItem(r));

    }
    catch(err) {
        throw new DatabaseError('Failed to fetch subscribed items for channel.', { cause: err });
    }
}

async function createSubscription(parent: number, s: Omit<SubscribedItem<SubscribedItemType>, 'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'>): Promise<SubscribedItem<SubscribedItemType>> {
    try {
        const data = await query<ISubscribedItemUnionType>(
            `INSERT INTO SubscribedItems (title, entityid, owner, crosspost, compact, message, type, parent, config)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [s.title, s.entityid, s.owner, s.crosspost, s.compact, s.message, s.type, parent, s.config]
        );
        return new SubscribedItem(data.rows[0]);

    }
    catch(err) {
        throw new DatabaseError('Failed to create subscription for channel.', { cause: err });
    }
}

async function updateSubscription(id: number, parent: number, s: Omit<SubscribedItem<SubscribedItemType>, 'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'>): Promise<SubscribedItem<SubscribedItemType>> {
    try {
        const data = await query<ISubscribedItemUnionType>(
            `UPDATE SubscribedItems SET title=$1, entityid=$2, owner=$3, crosspost=$4, compact=$5, message=$6, type=$7, parent=$8, config=$9, last_update=CURRENT_DATE
                WHERE id=$10 RETURNING *`,
            [s.title, s.entityid, s.owner, s.crosspost, s.compact, s.message, s.type, parent, s.config, id]
        );
        return new SubscribedItem(data.rows[0]);

    }
    catch(err) {
        throw new DatabaseError('Failed to update subscription for channel.', { cause: err });
    }
}

async function deleteSubscription(id: number): Promise<void> {
    try {
        await query(
            `DELETE FROM SubscribedItems WHERE id=$1`,
            [id]
        );
        return;

    }
    catch(err) {
        throw new DatabaseError('Failed to update subscription for channel.', { cause: err });
    }
}

async function saveLastUpdatedForSub(id: number, date: Date, status: string = '') {
    try {
        const data = await query<ISubscribedItemUnionType>(
            `UPDATE SubscribedItems 
            SET last_update = $1, 
                config = CASE 
                    WHEN $2 <> '' THEN 
                        jsonb_set(
                            COALESCE(config, '{}'), 
                            '{last_status}', 
                            to_jsonb($2::TEXT)
                        )
                    ELSE config
                END
            WHERE id = $3 
            RETURNING *`,
            [date, status, id]
        );
        if (!data.rowCount) throw new Error('Did not get expected response when updating last updated time.');
        return new SubscribedItem(data.rows[0]);

    }
    catch(err) {
        throw new DatabaseError('Failed to update subscription for channel.', { cause: err });
    }
}

async function setDateForAllSubsInChannel(date: Date, guild: Snowflake, channel: Snowflake): Promise<SubscribedItem<SubscribedItemType>[]> {
    try {
        const data = await query<ISubscribedItemUnionType>(
            `UPDATE SubscribedItems si
            SET last_update = $1 
            FROM SubscribedChannels sc
            WHERE si.parent = sc.id
                AND sc.guild_id = $2
                AND sc.channel_id = $3
            RETURNING si.*`,
            [date, guild, channel]
        );
        return data.rows.map(r => new SubscribedItem(r));

    }
    catch(err) {
        throw new DatabaseError('Failed to update subscription for channel.', { cause: err });
    }
}

export type NewSubscriptionData = Omit<
    SubscribedItem<SubscribedItemType>,
    'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'
>;

export { 
    getSubscribedItems, subscribeChannelTo, updateChannelSubscription,
    totalItemsInGuild, getSubscribedChannelsForGuild,
    getSubscribedChannels, getCountOfSubscriptions, getSubscribedChannel, createSubscribedChannel, updateSubscribedChannel,
    getAllSubscriptions, updateSubscription, saveLastUpdatedForSub, deleteSubscription,
    setDateForAllSubsInChannel, deleteSubscribedChannel
};