import { Snowflake } from 'discord.js';
import { ISubscribedChannel, ISubscribedItemUnionType, SubscribedChannel, SubscribedItem, SubscribedItemType } from '../types/subscriptions';
import { queryPromise } from './dbConnect';
import { logger } from '../DiscordBot';

// CHANNEL HANDLERS

async function getSubscribedChannels(): Promise<SubscribedChannel[]> {
    try {
        const data = await queryPromise<ISubscribedChannel>(
            'SELECT * FROM SubscribedChannels',
            []
        );
        const subs = await getAllSubscriptions()
        const promises = data.rows.map(async r => { return await SubscribedChannel.create(r, logger, subs.filter(s => s.parent === r.id)) });
        const channels = await Promise.all(promises);
        
        return channels;

    }
    catch(err) {
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to fetch subscribed channels.\n${error.message}`;
        throw error;
    }
}
async function getSubscribedChannelsForGuild(guild: Snowflake): Promise<SubscribedChannel[]> {
    try {
        const data = await queryPromise<ISubscribedChannel>(
            'SELECT * FROM SubscribedChannels WHERE guild_id=$1',
            [guild]
        );
        if (data.rows.length === 0) return [];
        else {
            const channels = Promise.all(
                data.rows.map(async r => await SubscribedChannel.create(r, logger))
            )
            return (await channels).filter(c => c);
        }

    }
    catch(err) {
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to fetch subscribed channels for guild.\n${error.message}`;
        throw error;
    }

}

async function getSubscribedChannel(guild: Snowflake, channel: Snowflake): Promise<SubscribedChannel | undefined> {
    try {
        const data = await queryPromise<ISubscribedChannel>(
            'SELECT * FROM SubscribedChannels WHERE guild_id=$1 AND channel_id=$2',
            [guild, channel]
        );
        if (data.rows.length === 0) return undefined;
        else return await SubscribedChannel.create(data.rows[0], logger);

    }
    catch(err) {
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to fetch subscribed channel.\n${error.message}`;
        throw error;
    }
}

async function createSubscribedChannel(c: Omit<ISubscribedChannel, 'id' | 'created' | 'last_update'>): Promise<SubscribedChannel> {
    try {
        const data = await queryPromise<ISubscribedChannel>(
            `INSERT INTO SubscribedChannels (guild_id, channel_id, webhook_id, webhook_token)
                VALUES ($1, $2, $3, $4) RETURNING *`,
            [c.guild_id, c.channel_id, c.webhook_id, c.webhook_token]
        );
        return new SubscribedChannel(data.rows[0], [], logger);
    }
    catch(err) {
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to create subscribed channel.\n${error.message}`;
        throw error;
    }
}

async function updateSubscribedChannel(c: ISubscribedChannel, date: Date): Promise<SubscribedChannel> {
    try {
        const data = await queryPromise<ISubscribedChannel>(
            `UPDATE SubscribedChannels SET last_update=$1
                WHERE id=$2 RETURNING *`,
            [date, c.id]
        );
        return new SubscribedChannel(data.rows[0], [], logger);
    }
    catch(err) {
        const error: Error = (err as Error);
        error.message = `Failed to update subscribed channel.\n${error.message}`;
        throw error;
    }
}

async function deleteSubscribedChannel(c: ISubscribedChannel): Promise<void> {
    try {
        await queryPromise<ISubscribedChannel>(
            `WITH deleted AS (
                DELETE FROM SubscribedChannels WHERE id=$1 RETURNING id
            )
            DELETE FROM SubscribedItems WHERE parent IN (SELECT id FROM deleted)`,
            [c.id]
        );
        return;
    }
    catch(err) {
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to delete subscribed channel.\n${error.message}`;
        throw error;
    }
}

async function totalItemsInGuild(guild: Snowflake): Promise<number> {
    try {
        const result = await queryPromise(
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
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to fetch total items in guild.\n${error.message}`;
        throw error;
    }

}

// SUBSCRIBED ITEM HANDLERS

async function getAllSubscriptions(): Promise<SubscribedItem<SubscribedItemType>[]> {
    try {
        const data = await queryPromise<ISubscribedItemUnionType>(
            'SELECT * FROM SubscribedItems',
            []
        );
        return data.rows.map(r => new SubscribedItem(r));

    }
    catch(err) {
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to fetch all subscribed items.\n${error.message}`;
        throw error;
    }

}

async function getSubscriptionsByChannel(guild: Snowflake, channel: Snowflake): Promise<SubscribedItem<SubscribedItemType>[]> {
    try {
        const data = await queryPromise<ISubscribedItemUnionType>(
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
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to fetch subscribed items for channel.\n${error.message}`;
        throw error;
    }
}

async function createSubscription(parent: number, s: Omit<SubscribedItem<SubscribedItemType>, 'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'>): Promise<SubscribedItem<SubscribedItemType>> {
    try {
        const data = await queryPromise<ISubscribedItemUnionType>(
            `INSERT INTO SubscribedItems (title, entityid, owner, crosspost, compact, message, type, parent, config)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [s.title, s.entityid, s.owner, s.crosspost, s.compact, s.message, s.type, parent, s.config]
        );
        return new SubscribedItem(data.rows[0]);

    }
    catch(err) {
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to create subscription for channel.\n${error.message}`;
        throw error;
    }
}

async function updateSubscription(id: number, parent: number, s: Omit<SubscribedItem<SubscribedItemType>, 'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'>): Promise<SubscribedItem<SubscribedItemType>> {
    try {
        const data = await queryPromise<ISubscribedItemUnionType>(
            `UPDATE SubscribedItems SET title=$1, entityid=$2, owner=$3, crosspost=$4, compact=$5, message=$6, type=$7, parent=$8, config=$9, last_update=CURRENT_DATE
                WHERE id=$10 RETURNING *`,
            [s.title, s.entityid, s.owner, s.crosspost, s.compact, s.message, s.type, parent, s.config, id]
        );
        return new SubscribedItem(data.rows[0]);

    }
    catch(err) {
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to update subscription for channel.\n${error.message}`;
        throw error;
    }
}

async function deleteSubscription(id: number): Promise<void> {
    try {
        await queryPromise(
            `DELETE FROM SubscribedItems WHERE id=$1`,
            [id]
        );
        return;

    }
    catch(err) {
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to update subscription for channel.\n${error.message}`;
        throw error;
    }
}

async function saveLastUpdatedForSub(id: number, date: Date, status: string = '') {
    try {
        const data = await queryPromise<ISubscribedItemUnionType>(
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
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to update subscription for channel.\n${error.message}`;
        throw error;
    }
}

async function setDateForAllSubsInChannel(date: Date, guild: Snowflake, channel: Snowflake): Promise<SubscribedItem<SubscribedItemType>[]> {
    try {
        const data = await queryPromise<ISubscribedItemUnionType>(
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
        const error: Error = (typeof err === 'string') ? new Error(err) : (err as Error);
        error.message = `Failed to update subscription for channel.\n${error.message}`;
        throw error;
    }
}

// DEBUG

async function ensureSubscriptionsDB() {
    try {
        await queryPromise(
            `CREATE TABLE IF NOT EXISTS SubscribedChannels (
                id integer PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 0 MINVALUE 0 MAXVALUE 2147483647 CACHE 1 ),           -- ID of the channel subscription
                guild_id VARCHAR(255) NOT NULL,        -- Guild ID (Snowflake as a string)
                channel_id VARCHAR(255) NOT NULL,      -- Channel ID (Snowflake as a string)
                webhook_id VARCHAR(255) NOT NULL,      -- Webhook ID (Snowflake as a string)
                webhook_token VARCHAR(255) NOT NULL,   -- Webhook token (string)
                last_update timestamp with time zone DEFAULT CURRENT_TIMESTAMP,         -- Last update date
                created timestamp with time zone DEFAULT CURRENT_TIMESTAMP              -- Created date
            );`,
            []
        )
        await queryPromise(
            `CREATE TABLE IF NOT EXISTS SubscribedItems (
                id integer PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 0 MINVALUE 0 MAXVALUE 2147483647 CACHE 1 ),           -- ID of the item
                parent INT NOT NULL,                   -- Parent ID
                title VARCHAR(255) NOT NULL,           -- Title of the item
                entityid VARCHAR(255) NOT NULL,        -- Entity ID (can be a string or number, storing as string)
                owner VARCHAR(255) NOT NULL,           -- Owner (Snowflake is a string)
                last_update timestamp with time zone DEFAULT CURRENT_TIMESTAMP,         -- Last update date
                created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,             -- Created date
                crosspost BOOLEAN,            -- Whether it is crossposted
                compact BOOLEAN,              -- Whether it is compact
                message TEXT,                 -- Message associated with the item
                error_count INT NOT NULL DEFAULT 0,              -- Error count
                type VARCHAR(50) NOT NULL,             -- Type of item (Game, Mod, Collection, User)
                config JSONB,
                CONSTRAINT fk_parent FOREIGN KEY (parent) REFERENCES SubscribedChannels(id)
            );
            `,
            []
        )

    }
    catch(err) {
        logger.error('Critial Error creating tables for subscriptions!', err);
        throw new Error('Failed to create database tables for subscriptions')
    }
}


export { 
    ensureSubscriptionsDB, totalItemsInGuild, getSubscribedChannelsForGuild,
    getSubscribedChannels, getSubscribedChannel, createSubscribedChannel, updateSubscribedChannel,
    getAllSubscriptions, getSubscriptionsByChannel, createSubscription,
    updateSubscription, saveLastUpdatedForSub, deleteSubscription,
    setDateForAllSubsInChannel, deleteSubscribedChannel
};