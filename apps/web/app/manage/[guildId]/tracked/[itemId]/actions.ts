'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logger } from '@nexusmods/core/logger.js';
import { saveSubscriptionSettings, deleteChannelSubscription } from '@nexusmods/persistence/subscriptions.js';
import { currentSession } from '@/lib/auth/session';
import { guildAccess } from '@/lib/auth/guilds';
import { findTrackedItem } from '@/lib/manage/trackedItem';
import { settingsFrom, writableKeys, changedFields } from '@/lib/manage/editTrackedItem';
import type { SubmittedFields } from '@/lib/manage/editTrackedItem';

/**
 * Writing a tracked item from the portal.
 *
 * Server actions rather than route handlers: Next adds its own Origin check, the form
 * still works with scripting off, and there is no new URL to guard. Everything the form
 * says about who is asking is ignored - the session is read here, the permission is
 * checked here, and the item is looked up scoped to the guild here. The hidden guild and
 * item fields only say *which* row to go and verify.
 */

export interface SaveState {
    status: 'idle' | 'saved' | 'error';
    error?: string;
}

async function authorise(guildId: string, itemId: number) {
    const session = await currentSession();
    if (!session) return { error: 'Your session has expired. Sign in again to save changes.' } as const;

    const { guild, unavailable } = await guildAccess(guildId);
    if (unavailable) return { error: 'Discord did not answer in time. Try again in a moment.' } as const;
    // The same answer for "not yours" and "no such server": saying which is which would
    // confirm to an outsider that a server exists and this bot is in it.
    if (!guild?.canManageFeeds) return { error: 'You need the Manage Channels permission in this server.' } as const;

    const found = await findTrackedItem(guildId, itemId);
    if (!found) return { error: 'That feed no longer exists.' } as const;

    return { session, found } as const;
}

export async function saveTrackedItem(_prev: SaveState, formData: FormData): Promise<SaveState> {
    const guildId = String(formData.get('guildId') ?? '');
    const itemId = Number(formData.get('itemId'));

    const auth = await authorise(guildId, itemId);
    if ('error' in auth) return { status: 'error', error: auth.error };
    const { session, found } = auth;
    const { item } = found;

    // Read only the keys this item's type actually declares. A key posted for a type that
    // does not have it is not an error worth reporting - it simply is not read.
    const config: SubmittedFields['config'] = {};
    for (const spec of writableKeys(item.type)) {
        const value = formData.get(`config.${spec.key}`);
        if (value !== null) config[spec.key] = String(value);
    }

    const assembled = settingsFrom(item.type, item.config as Record<string, unknown> | undefined, {
        crosspost: formData.get('crosspost') !== null,
        compact: formData.get('compact') !== null,
        message: String(formData.get('message') ?? ''),
        config,
    });
    if (!assembled.ok) return { status: 'error', error: assembled.error };

    const changed = changedFields(
        {
            crosspost: item.crosspost,
            compact: item.compact,
            message: item.message,
            config: (item.config ?? {}) as Record<string, unknown>,
        },
        assembled.settings,
    );

    if (changed.length === 0) return { status: 'saved' };

    const saved = await saveSubscriptionSettings(item.id, item.parent, assembled.settings);
    if (!saved) return { status: 'error', error: 'That feed no longer exists.' };

    // No audit table, so this log line is the only record that a human changed a feed
    // from the web rather than the bot changing it for them. Field names, never values.
    logger.info('Tracked item updated from the portal', {
        actor: session.id, guildId, itemId: item.id, changed,
    });

    revalidatePath(`/manage/${guildId}/tracked`);
    return { status: 'saved' };
}

export async function deleteTrackedItem(_prev: SaveState, formData: FormData): Promise<SaveState> {
    const guildId = String(formData.get('guildId') ?? '');
    const itemId = Number(formData.get('itemId'));

    const auth = await authorise(guildId, itemId);
    if ('error' in auth) return { status: 'error', error: auth.error };
    const { session, found } = auth;
    const { item } = found;

    const removed = await deleteChannelSubscription(item.id, item.parent);
    if (!removed) return { status: 'error', error: 'That feed no longer exists.' };

    logger.info('Tracked item deleted from the portal', {
        actor: session.id, guildId, itemId: item.id, type: item.type, title: item.title,
    });

    revalidatePath(`/manage/${guildId}/tracked`);
    // Outside any try: redirect throws by design, and the item page it would return to
    // has just stopped existing.
    redirect(`/manage/${guildId}/tracked`);
}
