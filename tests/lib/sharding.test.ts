import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    forceChannelUpdateOnOwningShard,
    ownsGuild,
    postNewsOnOwningShard,
    requestSubscriptionRefreshOnOtherShards,
    requireShard,
    shardIdForGuild,
    totalGuildCount,
} from '../../src/lib/sharding.js';

const broadcastEval = vi.fn();
const clientOn = (id: number, count = 3) => ({ shard: { ids: [id], count, broadcastEval } }) as any;

beforeEach(() => { broadcastEval.mockReset(); });

/**
 * Re-create a callback the way discord.js does: stringify it, evaluate the string, and
 * call the result. `new Function` compiles in the global scope, so the rebuilt function
 * has no closure over anything here - exactly like the copy that runs in another shard's
 * process.
 *
 * This is the whole reason the callbacks were collected into one module. A captured
 * variable is invisible at the call site, compiles cleanly, and fails as a
 * ReferenceError in a different process.
 */
function asRemote<T extends (...args: never[]) => unknown>(fn: T): T {
    return new Function(`return (${fn.toString()})`)() as T;
}
const lastCallback = () => asRemote(broadcastEval.mock.calls[0][0]);
const lastContext = () => broadcastEval.mock.calls[0][1]?.context;

describe('requireShard', () => {
    it('returns the util when the process is a shard', () => {
        expect(requireShard(clientOn(1)).ids[0]).toBe(1);
    });

    // Replaces roughly thirty `if (client.shard)` branches that guarded a mode
    // production has never run. One loud failure beats thirty silent divergences.
    it('throws rather than silently taking an unsharded path', () => {
        expect(() => requireShard({ shard: null } as any)).toThrow(/only runs under the sharding manager/);
    });
});

describe('guild ownership', () => {
    it('agrees with itself: the owning shard owns the guild', () => {
        const guild = '215154001799413770';
        const owner = shardIdForGuild(clientOn(0), guild);
        expect(ownsGuild(clientOn(owner), guild)).toBe(true);
        expect(ownsGuild(clientOn((owner + 1) % 3), guild)).toBe(false);
    });
});

describe('totalGuildCount', () => {
    it('sums the per-shard counts, because each shard only knows its own', async () => {
        broadcastEval.mockResolvedValue([806, 811, 801]);
        await expect(totalGuildCount(clientOn(0))).resolves.toBe(2418);
    });

    it('asks every shard for its cache size', async () => {
        broadcastEval.mockResolvedValue([1]);
        await totalGuildCount(clientOn(0));
        expect(lastCallback()({ guilds: { cache: { size: 42 } } } as any)).toBe(42);
    });
});

describe('requestSubscriptionRefreshOnOtherShards', () => {
    beforeEach(() => { broadcastEval.mockResolvedValue([]); });

    it('skips the caller and triggers everyone else', async () => {
        await requestSubscriptionRefreshOnOtherShards(clientOn(1));
        const remote = lastCallback();
        const ctx = lastContext();

        const other = { shard: { ids: [2] }, subscriptions: { handleRefreshRequest: vi.fn() } };
        const self = { shard: { ids: [1] }, subscriptions: { handleRefreshRequest: vi.fn() } };
        remote(other as any, ctx);
        remote(self as any, ctx);

        expect(other.subscriptions.handleRefreshRequest).toHaveBeenCalledOnce();
        expect(self.subscriptions.handleRefreshRequest).not.toHaveBeenCalled();
    });

    it('does not wait on the refresh it asked for', async () => {
        await requestSubscriptionRefreshOnOtherShards(clientOn(0));
        const never = new Promise(() => undefined);
        const result = lastCallback()(
            { shard: { ids: [9] }, subscriptions: { handleRefreshRequest: () => never } } as any,
            lastContext(),
        );
        expect(result).toBeUndefined();
    });
});

describe('forceChannelUpdateOnOwningShard', () => {
    const message = {
        type: 'forceChannelUpdate' as const,
        id: 7, guild_id: '111', channel_id: '222',
        date: new Date('2026-08-30T00:00:00.000Z').toISOString(),
        shardId: 2,
    };

    it('is true when the owning shard handled it', async () => {
        broadcastEval.mockResolvedValue([false, false, true]);
        await expect(forceChannelUpdateOnOwningShard(clientOn(0), message)).resolves.toBe(true);
    });

    it('is false when no shard did', async () => {
        broadcastEval.mockResolvedValue([false, false, false]);
        await expect(forceChannelUpdateOnOwningShard(clientOn(0), message)).resolves.toBe(false);
    });

    it('runs on the addressed shard only', async () => {
        broadcastEval.mockResolvedValue([]);
        await forceChannelUpdateOnOwningShard(clientOn(0), message);
        const remote = lastCallback();

        const owner = { shard: { ids: [2] }, subscriptions: { handleForceUpdate: vi.fn() } };
        const bystander = { shard: { ids: [0] }, subscriptions: { handleForceUpdate: vi.fn() } };
        await expect(remote(owner as any, message)).resolves.toBe(true);
        await expect(remote(bystander as any, message)).resolves.toBe(false);
        expect(owner.subscriptions.handleForceUpdate).toHaveBeenCalledWith(message);
        expect(bystander.subscriptions.handleForceUpdate).not.toHaveBeenCalled();
    });

    // discord.js serialises the context as JSON, which is why the date crosses as a
    // string rather than a Date.
    it('sends a context that survives JSON', async () => {
        broadcastEval.mockResolvedValue([]);
        await forceChannelUpdateOnOwningShard(clientOn(0), message);
        expect(JSON.parse(JSON.stringify(lastContext()))).toEqual(message);
    });
});

describe('postNewsOnOwningShard', () => {
    it('returns the embed the owning shard built', async () => {
        broadcastEval.mockResolvedValue([undefined, { title: 'News' }, undefined]);
        await expect(postNewsOnOwningShard(clientOn(0), 1, 'skyrim')).resolves.toEqual({ title: 'News' });
    });

    it('returns undefined when no shard could post, leaving the decision to the caller', async () => {
        broadcastEval.mockResolvedValue([undefined, undefined]);
        await expect(postNewsOnOwningShard(clientOn(0), 1, undefined)).resolves.toBeUndefined();
    });

    it('hands back the embed data, not the builder, since only JSON crosses', async () => {
        broadcastEval.mockResolvedValue([]);
        await postNewsOnOwningShard(clientOn(0), 1, 'skyrim');
        const remote = lastCallback();
        const owner = { shard: { ids: [1] }, newsFeed: { handleNewsRequest: async () => ({ data: { title: 'News' } }) } };
        await expect(remote(owner as any, lastContext())).resolves.toEqual({ title: 'News' });
        const bystander = { shard: { ids: [0] }, newsFeed: { handleNewsRequest: vi.fn() } };
        await expect(remote(bystander as any, lastContext())).resolves.toBeUndefined();
        expect(bystander.newsFeed.handleNewsRequest).not.toHaveBeenCalled();
    });
});
