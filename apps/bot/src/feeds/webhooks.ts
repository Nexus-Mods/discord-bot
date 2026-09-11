import { WebhookClient } from 'discord.js';
import type { ISubscribedChannel } from '@nexusmods/persistence/types/subscriptions.js';

/**
 * WebhookClients for subscribed channels.
 *
 * SubscribedChannel used to build one in its constructor, which meant every read of a
 * subscription constructed Discord I/O - including the auth site's tracking page, which
 * only wants names and dates. Posting is a feed concern, so the client is built here.
 *
 * Cached by webhook id. A WebhookClient carries its own REST instance and rate-limit
 * state, and channels are reconstructed on every poll; building one per post would be
 * more churn than the constructor it replaces, not less.
 */
const clients = new Map<string, WebhookClient>();

export function webhookFor(channel: Pick<ISubscribedChannel, 'webhook_id' | 'webhook_token'>): WebhookClient {
    const existing = clients.get(channel.webhook_id);
    if (existing) return existing;
    const client = new WebhookClient({ id: channel.webhook_id, token: channel.webhook_token });
    clients.set(channel.webhook_id, client);
    return client;
}
