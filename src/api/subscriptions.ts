import { Snowflake } from 'discord.js';
import { ISubscribedChannel, ISubscribedItemUnionType, SubscribedChannel, SubscribedItem } from '../types/subscriptions';
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

async function createSubscribedChannel(c: Omit<ISubscribedChannel, 'id' | 'created' | 'last_update'>): Promise<SubscribedChannel> {
    try {
        const data = await queryPromise<ISubscribedChannel>(
            `INSERT INTO SubscribedChannel (guild_id, channel_id, webhook_id, webhook_token)
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
            'SELECT * FROM SubscribedItems WHERE guild_id=$1 AND channel_id=$2',
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

// DEBUG

async function ensureSubscriptionsDB() {
    try {
        await queryPromise(
            `CREATE TABLE IF NOT EXISTS SubscribedChannels (
                id INT PRIMARY KEY,           -- ID of the channel subscription
                guild_id VARCHAR(255),        -- Guild ID (Snowflake as a string)
                channel_id VARCHAR(255),      -- Channel ID (Snowflake as a string)
                webhook_id VARCHAR(255),      -- Webhook ID (Snowflake as a string)
                webhook_token VARCHAR(255),   -- Webhook token (string)
                last_update DATETIME DEFAULT CURRENT_TIMESTAMP,         -- Last update date
                created DATETIME DEFAULT CURRENT_TIMESTAMP              -- Created date
            );`,
            []
        )
        await queryPromise(
            `CREATE TABLE IF NOT EXISTS SubscribedItems (
                id INT PRIMARY KEY,           -- ID of the item
                parent INT,                   -- Parent ID
                title VARCHAR(255),           -- Title of the item
                entityId VARCHAR(255),        -- Entity ID (can be a string or number, storing as string)
                owner VARCHAR(255),           -- Owner (Snowflake is a string)
                last_update DATETIME DEFAULT CURRENT_TIMESTAMP,         -- Last update date
                created DATETIME DEFAULT CURRENT_TIMESTAMP,             -- Created date
                crosspost BOOLEAN,            -- Whether it is crossposted
                compact BOOLEAN,              -- Whether it is compact
                message TEXT,                 -- Message associated with the item
                error_count INT,              -- Error count
                nsfw BOOLEAN DEFAULT FALSE,   -- NSFW flag (optional)
                sfw BOOLEAN DEFAULT TRUE,    -- SFW flag (optional)
                type VARCHAR(50),             -- Type of item (Game, Mod, Collection, User)
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
    getSubscribedChannels, createSubscribedChannel, 
    getAllSubscriptions, getSubscriptionsByChannel 
};