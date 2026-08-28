import {
    bigint, boolean, foreignKey, integer, jsonb, pgTable, serial, text, timestamp,
    unique, varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The database as it actually exists.
 *
 * Written from a schema-only dump of production, because until 4.0.0 there was no
 * migration system and no schema in the repository at all: `users`, `servers`,
 * `tips`, `automod_rules`, `automod_badfiles` and `server_role_conditions` had no
 * creation code anywhere, and `subscribedchannels`/`news` were created lazily by
 * CREATE TABLE IF NOT EXISTS calls scattered through the data layer.
 *
 * This file is the source of truth from now on: change it, generate a migration,
 * commit both.
 */

export const users = pgTable('users', {
    dId: varchar('d_id').notNull(),
    id: integer('id').notNull(),
    name: varchar('name').notNull(),
    avatarUrl: varchar('avatar_url'),
    supporter: boolean('supporter').default(false).notNull(),
    premium: boolean('premium').default(false).notNull(),
    lastupdate: timestamp('lastupdate', { withTimezone: true }).notNull(),
    modauthor: boolean('modauthor').default(false).notNull(),
    // Plaintext OAuth tokens. Encrypting these at rest is S9, still open.
    nexusAccess: varchar('nexus_access'),
    nexusRefresh: varchar('nexus_refresh'),
    nexusExpires: bigint('nexus_expires', { mode: 'number' }),
    discordAccess: varchar('discord_access'),
    discordRefresh: varchar('discord_refresh'),
    discordExpires: bigint('discord_expires', { mode: 'number' }),
}, (t) => [
    // Note the trailing space in the constraint name - that is how it exists in
    // production, and renaming it is a migration in its own right.
    unique('Discord ID ').on(t.dId),
    unique('Nexus Mods ID').on(t.id),
]);

export const servers = pgTable('servers', {
    id: varchar('id').notNull(),
    official: boolean('official').default(false).notNull(),
    channelNexus: varchar('channel_nexus'),
    roleAuthor: varchar('role_author'),
    gameFilter: varchar('game_filter'),
    serverOwner: varchar('server_owner').notNull(),
    channelNews: varchar('channel_news'),
});

export const subscribedChannels = pgTable('subscribedchannels', {
    id: integer('id').generatedAlwaysAsIdentity({ startWith: 0, minValue: 0 }).primaryKey(),
    guildId: varchar('guild_id', { length: 255 }).notNull(),
    channelId: varchar('channel_id', { length: 255 }).notNull(),
    webhookId: varchar('webhook_id', { length: 255 }).notNull(),
    webhookToken: varchar('webhook_token', { length: 255 }).notNull(),
    lastUpdate: timestamp('last_update', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
    created: timestamp('created', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

export const subscribedItems = pgTable('subscribeditems', {
    id: integer('id').generatedAlwaysAsIdentity({ startWith: 0, minValue: 0 }).primaryKey(),
    parent: integer('parent').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    entityid: varchar('entityid', { length: 255 }).notNull(),
    owner: varchar('owner', { length: 255 }).notNull(),
    lastUpdate: timestamp('last_update', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
    created: timestamp('created', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
    crosspost: boolean('crosspost'),
    compact: boolean('compact'),
    message: text('message'),
    errorCount: integer('error_count'),
    nsfw: boolean('nsfw').default(false),
    sfw: boolean('sfw').default(true),
    type: varchar('type', { length: 50 }).notNull(),
    // Superseded by `config`, kept because production still has them.
    showNew: boolean('show_new'),
    showUpdates: boolean('show_updates'),
    lastStatus: varchar('last_status'),
    config: jsonb('config'),
}, (t) => [
    // Production names this constraint `fk_parent`; drizzle would otherwise
    // generate `subscribeditems_parent_subscribedchannels_id_fk` and propose
    // dropping and recreating it on the next diff.
    foreignKey({
        columns: [t.parent],
        foreignColumns: [subscribedChannels.id],
        name: 'fk_parent',
    }),
]);

export const tips = pgTable('tips', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity({ startWith: 0, minValue: 0 }).primaryKey(),
    prompt: varchar('prompt').notNull(),
    title: varchar('title').notNull(),
    embed: varchar('embed'),
    message: varchar('message'),
    created: timestamp('created', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated: timestamp('updated', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    author: varchar('author').notNull(),
    approved: boolean('approved').default(false),
});

export const news = pgTable('news', {
    title: varchar('title').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    id: integer('id'),
});

export const automodRules = pgTable('automod_rules', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity({ startWith: 0, minValue: 0, cycle: true }).primaryKey(),
    type: varchar('type').notNull(),
    filter: varchar('filter').notNull(),
    added: timestamp('added', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    reason: varchar('reason').default('Not provided').notNull(),
});

export const automodBadfiles = pgTable('automod_badfiles', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity({ startWith: 0, minValue: 0, cycle: true }).primaryKey(),
    type: varchar('type').notNull(),
    funcName: varchar('funcName').notNull(),
    test: varchar('test').notNull(),
    flagMessage: varchar('flagMessage').notNull(),
});

export const serverRoleConditions = pgTable('server_role_conditions', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity({ startWith: 0, minValue: 0, cycle: true }).primaryKey(),
    serverId: varchar('server_id').notNull(),
    roleId: varchar('role_id').notNull(),
    type: varchar('type').notNull(),
    game: varchar('game').notNull(),
    min: bigint('min', { mode: 'number' }).default(0),
    op: varchar('op').default('AND').notNull(),
});

/**
 * Tables production still has that no code references.
 *
 * game_feeds is the pre-subscriptions feed system, superseded by
 * subscribedchannels/subscribeditems. user_mods and user_servers have no readers
 * either. They are modelled here so the baseline matches production exactly and
 * drizzle does not propose dropping them; removing them is a deliberate migration
 * once someone confirms nothing external reads them.
 */
export const gameFeeds = pgTable('game_feeds', {
    channel: varchar('channel').notNull(),
    guild: varchar('guild').notNull(),
    owner: varchar('owner').notNull(),
    domain: varchar('domain').notNull(),
    title: varchar('title').notNull(),
    nsfw: boolean('nsfw').default(false).notNull(),
    sfw: boolean('sfw').default(true).notNull(),
    showNew: boolean('show_new').default(true).notNull(),
    showUpdates: boolean('show_updates').default(true).notNull(),
    webhookId: varchar('webhook_id'),
    webhookToken: varchar('webhook_token'),
    message: varchar('message'),
    lastTimestamp: timestamp('last_timestamp', { withTimezone: true }).notNull(),
    created: timestamp('created', { withTimezone: true }).notNull(),
    Id: serial('_id').notNull(),
    compact: boolean('compact').default(false).notNull(),
    errorCount: integer('error_count').default(0).notNull(),
    crosspost: boolean('crosspost').default(false).notNull(),
});

export const userMods = pgTable('user_mods', {
    domain: varchar('domain').notNull(),
    modId: integer('mod_id').notNull(),
    name: varchar('name'),
    game: varchar('game').notNull(),
    uniqueDownloads: integer('unique_downloads').default(0).notNull(),
    totalDownloads: integer('total_downloads').default(0).notNull(),
    path: varchar('path'),
    owner: integer('owner').notNull(),
});

export const userServers = pgTable('user_servers', {
    userId: varchar('user_id').notNull(),
    serverId: varchar('server_id').notNull(),
}, (t) => [unique('name and server').on(t.userId, t.serverId)]);
