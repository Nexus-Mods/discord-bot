import type { IModWithFiles, SubscribedItem, SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';

const HOUR_MS = 60 * 60 * 1000;

/** The configured cooldown between update posts for the same mod, in ms. 0 = no limit. */
export function updateCooldownMs(item: SubscribedItem<SubscribedItemType.Game>): number {
    return (item.config?.update_cooldown_hours ?? 0) * HOUR_MS;
}

/**
 * True when a file uploaded since `since` has a changelog that differs from the file
 * that came before it. An empty changelog never counts, and neither does one that
 * just repeats what the previous file already said.
 */
export function changelogChanged(mod: IModWithFiles, since: Date): boolean {
    // The API returns files newest first, but don't rely on that here.
    const files = [...(mod.files ?? [])].sort((a, b) => b.date - a.date);
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.date * 1000 <= since.getTime()) break;
        const text = (file.changelogText ?? []).join('\n');
        if (text.length && text !== (files[i + 1]?.changelogText ?? []).join('\n')) return true;
    }
    return false;
}

/**
 * Whether an update to `mod` should be posted under the subscription's update
 * filters. With both options set an update goes out when either condition passes:
 * the changelog moved, or the mod hasn't pinged the channel within the cooldown.
 */
export function modUpdateAllowed(mod: IModWithFiles, item: SubscribedItem<SubscribedItemType.Game>, now: number = Date.now()): boolean {
    const cooldownMs = updateCooldownMs(item);
    if (!item.config?.changelog_only && cooldownMs <= 0) return true;
    if (item.config?.changelog_only && changelogChanged(mod, item.last_update)) return true;
    if (cooldownMs > 0) {
        const posted = item.config?.last_posted?.[mod.uid];
        if (!posted || now - new Date(posted).getTime() >= cooldownMs) return true;
    }
    return false;
}

/**
 * Stamp `now` as the last posted time for each mod, dropping entries older than
 * the cooldown window since they can no longer suppress anything. Returns the
 * map so it can be persisted with the subscription.
 */
export function markUpdatesPosted(item: SubscribedItem<SubscribedItemType.Game>, mods: IModWithFiles[], now: Date = new Date()): Record<string, string> {
    const last_posted: Record<string, string> = { ...(item.config?.last_posted ?? {}) };
    const cutoff = now.getTime() - updateCooldownMs(item);
    for (const [uid, iso] of Object.entries(last_posted)) {
        if (new Date(iso).getTime() < cutoff) delete last_posted[uid];
    }
    for (const mod of mods) last_posted[mod.uid] = now.toISOString();
    item.config = { ...(item.config ?? {}), last_posted };
    return last_posted;
}
