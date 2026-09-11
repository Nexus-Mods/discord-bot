import { type APIEmbed, type Client, ShardClientUtil, type Snowflake } from 'discord.js';
import type { ClientExt } from '../types/DiscordTypes.js';

/**
 * Everything this bot sends between shards.
 *
 * `broadcastEval` stringifies its callback and evaluates it in another process, so the
 * callback CAPTURES NOTHING - a reference to an enclosing variable is a ReferenceError
 * over there - and the `client` type annotation is an assertion, not a check.
 *
 * Everything a callback needs arrives through `context`, which is serialised as JSON: no
 * Dates, Maps or class instances, hence the ISO string on ForceUpdateMessage.
 */

/**
 * The bot only runs sharded, so `client.shard` is always populated - it is typed nullable,
 * and one loud failure beats thirty unsharded branches production never runs.
 */
export function requireShard(client: Client): ShardClientUtil {
    if (!client.shard) {
        throw new Error('No ShardClientUtil on the client. The bot only runs under the sharding manager - see dist/shards.js.');
    }
    return client.shard;
}

/** Which shard owns a guild. Discord's own formula, not ours. */
export function shardIdForGuild(client: Client, guildId: Snowflake): number {
    return ShardClientUtil.shardIdForGuildId(guildId, requireShard(client).count);
}

/** Whether this process is the one holding a given guild. */
export function ownsGuild(client: Client, guildId: Snowflake): boolean {
    return shardIdForGuild(client, guildId) === requireShard(client).ids[0];
}

/** Guilds across every shard: each process only knows its own, so the figure is summed. */
export async function totalGuildCount(client: Client): Promise<number> {
    const perShard = await requireShard(client).broadcastEval((c) => c.guilds.cache.size);
    return perShard.reduce((total, count) => total + count, 0);
}

/**
 * Ask every other shard to refresh its subscriptions. Deliberately not awaited: a refresh
 * takes longer than broadcastEval will wait.
 */
export async function requestSubscriptionRefreshOnOtherShards(client: ClientExt): Promise<void> {
    const callerId = requireShard(client).ids[0];
    await requireShard(client).broadcastEval(
        (c: ClientExt, { callerId: caller }: { callerId: number }) => {
            if (c.shard?.ids[0] !== caller) c.subscriptions?.handleRefreshRequest();
        },
        { context: { callerId } },
    );
}

/** JSON-safe, because discord.js serialises the context. Note `date` is an ISO string. */
export interface ForceUpdateMessage {
    type: 'forceChannelUpdate';
    id: number;
    guild_id: Snowflake;
    channel_id: Snowflake;
    date: string;
    shardId: number;
}

/**
 * Run a channel's force-update on whichever shard holds its guild. Every shard runs the
 * callback; all but the owning one return false immediately.
 */
export async function forceChannelUpdateOnOwningShard(client: ClientExt, message: ForceUpdateMessage): Promise<boolean> {
    const handled = await requireShard(client).broadcastEval(
        async (c: ClientExt, msg: ForceUpdateMessage) => {
            if (c.shard?.ids[0] !== msg.shardId) return false;
            await c.subscriptions?.handleForceUpdate(msg);
            return true;
        },
        { context: message },
    );
    return handled.some(Boolean);
}

/** Post the news from whichever shard holds the news guild. Undefined when none could. */
export async function postNewsOnOwningShard(client: ClientExt, shardId: number, domain: string | undefined): Promise<APIEmbed | undefined> {
    const results = await requireShard(client).broadcastEval(
        async (c: ClientExt, ctx: { shardId: number; domain: string | undefined }) => {
            if (c.shard?.ids[0] !== ctx.shardId) return undefined;
            const embed = await c.newsFeed?.handleNewsRequest(ctx.domain);
            return embed?.data;
        },
        { context: { shardId, domain } },
    );
    return results.find((r): r is APIEmbed => r !== undefined && r !== null);
}
