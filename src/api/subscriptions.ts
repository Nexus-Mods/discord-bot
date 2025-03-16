import { Snowflake } from 'discord.js';
import { ISubscribedChannel, ISubscribedItemUnionType, SubscribedChannel, SubscribedItem, SubscribedItemType } from '../types/subscriptions';
import { queryPromise } from './dbConnect';
import { logMessage } from './util';

// CHANNEL HANDLERS

async function getSubscribedChannels(): Promise<SubscribedChannel[]> {
    try {
        const data = await queryPromise<ISubscribedChannel>(
            'SELECT * FROM SubscribedChannels',
            []
        );
        const promises = data.rows.map(async r => { return await SubscribedChannel.create(r) });
        const channels = await Promise.all(promises);
        
        return channels;

    }
    catch(err) {
        const error: Error = (err as Error);
        error.message = `Failed to fetch subscribed channels.\n${error.message}`;
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
        else return await SubscribedChannel.create(data.rows[0]);

    }
    catch(err) {
        const error: Error = (err as Error);
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
        return new SubscribedChannel(data.rows[0], []);
    }
    catch(err) {
        const error: Error = (err as Error);
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
        return new SubscribedChannel(data.rows[0], []);
    }
    catch(err) {
        const error: Error = (err as Error);
        error.message = `Failed to create subscribed channel.\n${error.message}`;
        throw error;
    }
}

// SUBSCRIBED ITEM HANDLERS

async function getAllSubscriptions(): Promise<SubscribedItem[]> {
    try {
        const data = await queryPromise<ISubscribedItemUnionType>(
            'SELECT * FROM SubscribedItems',
            []
        );
        return data.rows.map(r => new SubscribedItem(r));

    }
    catch(err) {
        const error: Error = (err as Error);
        error.message = `Failed to fetch subscribed channels.\n${error.message}`;
        throw error;
    }

}

async function getSubscriptionsByChannel(guild: Snowflake, channel: Snowflake): Promise<SubscribedItem[]> {
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
        const error: Error = (err as Error);
        error.message = `Failed to fetch subscribed channels.\n${error.message}`;
        throw error;
    }
}

async function createSubscription(type: SubscribedItemType, parent: number, s: Omit<SubscribedItem, 'id' | 'parent' | 'created' | 'last_update' | 'error_count' | 'showAdult'>): Promise<SubscribedItem> {
    try {
        const data = await queryPromise<ISubscribedItemUnionType>(
            `INSERT INTO SubscribedItems (title, entityid, owner, crosspost, compact, message, nsfw, sfw, type, show_new, show_updates, parent)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [s.title, s.entityid, s.owner, s.crosspost, s.compact, s.message, s.nsfw, s.sfw, s.type, s.show_new, s.show_updates, parent]
        );
        return new SubscribedItem(data.rows[0]);

    }
    catch(err) {
        const error: Error = (err as Error);
        error.message = `Failed to create subscription for channel.\n${error.message}`;
        throw error;
    }
}

// DEBUG

async function ensureSubscriptionsDB() {
    try {
        await queryPromise(
            `CREATE TABLE IF NOT EXISTS SubscribedChannels (
                id bigint PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 0 MINVALUE 0 MAXVALUE 9223372036854775807 CACHE 1 ),           -- ID of the channel subscription
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
                id bigint PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 0 MINVALUE 0 MAXVALUE 9223372036854775807 CACHE 1 ),           -- ID of the item
                parent INT NOT NULL,                   -- Parent ID
                title VARCHAR(255) NOT NULL,           -- Title of the item
                entityid VARCHAR(255) NOT NULL,        -- Entity ID (can be a string or number, storing as string)
                owner VARCHAR(255) NOT NULL,           -- Owner (Snowflake is a string)
                last_update timestamp with time zone DEFAULT CURRENT_TIMESTAMP,         -- Last update date
                created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,             -- Created date
                crosspost BOOLEAN,            -- Whether it is crossposted
                compact BOOLEAN,              -- Whether it is compact
                message TEXT,                 -- Message associated with the item
                error_count INT,              -- Error count
                nsfw BOOLEAN DEFAULT FALSE,   -- NSFW flag (optional)
                sfw BOOLEAN DEFAULT TRUE,    -- SFW flag (optional)
                type VARCHAR(50) NOT NULL,             -- Type of item (Game, Mod, Collection, User)
                show_new BOOLEAN,             -- Only for Game type items
                show_updates BOOLEAN,         -- Only for Game type items
                CONSTRAINT fk_parent FOREIGN KEY (parent) REFERENCES SubscribedChannels(id)
            );
            `,
            []
        )

    }
    catch(err) {
        logMessage('Critial Error creating tables for subscriptions!', err, true);
        throw new Error('Failed to create database tables for subscriptions')
    }
}


export { 
    ensureSubscriptionsDB, 
    getSubscribedChannels, getSubscribedChannel, createSubscribedChannel, updateSubscribedChannel,
    getAllSubscriptions, getSubscriptionsByChannel, createSubscription
};