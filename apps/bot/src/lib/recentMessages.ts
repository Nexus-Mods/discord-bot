interface Seen { channelId: string; messageId: string; at: number }

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_USER = 250;

let writes = 0;
const PRUNE_EVERY = 500;
const MAX_USERS = 100;

const byUser = new Map<string, Seen[]>();

/** Only the guild that holds the bait channel - the intent is global, this index is not. */
export function remember(authorId: string, channelId: string, messageId: string): void {    
    const list = byUser.get(authorId) ?? [];
    list.push({ channelId, messageId, at: Date.now() });
    if (list.length > MAX_PER_USER) list.shift();
    byUser.set(authorId, list);

    if (++writes >= PRUNE_EVERY || byUser.size > MAX_USERS) {
        writes = 0;
        prune();
    }
}

/** Everything still inside the window, and forget it. */
export function take(authorId: string): Seen[] {
    const cutoff = Date.now() - WINDOW_MS;
    const list = (byUser.get(authorId) ?? []).filter((s) => s.at >= cutoff);
    byUser.delete(authorId);
    return list;
}

export function prune(now = Date.now()): void {
    const cutoff = now - WINDOW_MS;
    for (const [key, messages] of byUser) {
        // Newest is stale: the whole user is stale. The common case for an idle map.
        if (messages[messages.length - 1].at < cutoff) { byUser.delete(key); continue; }
        // Oldest is fresh: nothing to do. The common case for an active user.
        if (messages[0].at >= cutoff) continue;
        // Sorted, so everything before the first fresh entry goes.
        messages.splice(0, messages.findIndex((s) => s.at >= cutoff));
    }
}