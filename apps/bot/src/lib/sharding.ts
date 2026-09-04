import { type APIEmbed, type Client, ShardClientUtil, type Snowflake } from 'discord.js';
import type { ClientExt } from '../types/DiscordTypes.js';

/**
 * Everything this bot sends between shards.
 *
 * `broadcastEval` is not a function call. discord.js stringifies the callback and
 * evaluates it inside each shard's process, which has two consequences that no type
 * signature warns you about:
 *
 *   1. The callback captures nothing. A variable referenced from the enclosing scope is
 *      not undefined-at-runtime in a way you can see coming - it is a ReferenceError in
 *      another process, surfacing as a rejected promise with no obvious origin.
 *   2. The `client` it receives is whatever that process has. Annotating the parameter
 *      as ClientExt is an assertion, not a check.
 *
 * Collecting the callbacks here does not remove the eval, but it does mean every one of
 * them is two lines long, sits next to the type of the payload it is given, and is
 * written once rather than inline at the call site. The call sites get ordinary typed
 * functions and no longer have to remember any of the above.
 *
 * Everything a callback needs must arrive through `context`, which discord.js serialises
 * as JSON. That rules out Dates, Maps and class instances - hence the ISO string on
 * ForceUpdateMessage rather than a Date.
 */

/**
 * The bot only runs sharded - dist/app.js refuses to start unless the ShardingManager
 * spawned it - so `client.shard` is always populated. It is still typed as nullable,
 * and the codebase used to carry an unsharded fallback at 30-odd branches for a mode
 * production never ran. One loud failure is better than thirty silent divergences.
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

/**
 * Guilds across every shard.
 *
 * Each shard only knows its own, so `guilds.cache.size` on one process is a fraction of
 * the real number - the figure /about reports has to be summed.
 */
export async function totalGuildCount(client: Client): Promise<number> {
    const perShard = await requireShard(client).broadcastEval((c) => c.guilds.cache.size);
    return perShard.reduce((total, count) => total + count, 0);
}

/**
 * Ask every other shard to refresh its subscriptions.
 *
 * Fire and forget by design: the callback deliberately does not await, because a
 * subscription refresh takes far longer than broadcastEval is willing to wait and the
 * caller has nothing to do with the result.
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
 * Run a channel's force-update on whichever shard holds its guild.
 *
 * Resolves true when exactly the owning shard handled it. Every shard runs the callback
 * - that is what broadcast means - and all but one return false immediately.
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

/**
 * Post the news from whichever shard holds the news guild, and hand back the embed it
 * built. Returns undefined when no shard could - the caller decides whether that is an
 * error.
 */
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
