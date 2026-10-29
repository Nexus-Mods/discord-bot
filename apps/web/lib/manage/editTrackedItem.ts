import { configKeysFor } from '@nexusmods/persistence/types/subscriptionConfig.js';
import type { SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';
import type { SubscriptionSettings } from '@nexusmods/persistence/subscriptions.js';

/**
 * Turning a submitted form into the row that should be written.
 *
 * Pure, and separate from the action, because this is where the decisions are: which keys
 * a form may write, what an absent checkbox means, and what must survive a save untouched.
 * None of that needs a session or a database to test.
 */

/** The three posting columns, plus one raw value per config key the form rendered. */
export interface SubmittedFields {
    crosspost: boolean;
    compact: boolean;
    message: string;
    config: Record<string, string | undefined>;
}

export type Assembled =
    | { ok: true; settings: SubscriptionSettings }
    | { ok: false; error: string };

/** Discord rejects message content longer than this, so the save should rather than the post. */
export const MAX_MESSAGE_LENGTH = 2000;

/** What a form may write: everything declared for this type that the bot does not own. */
export function writableKeys(type: SubscribedItemType) {
    return configKeysFor(type).filter((spec) => !spec.readOnly);
}

/** A key with no fixed default is three-way - yes, no, or follow whatever it inherits. */
export function isTriState(spec: { default: boolean | null }): boolean {
    return spec.default === null;
}

export function settingsFrom(
    type: SubscribedItemType,
    existing: Record<string, unknown> | undefined | null,
    submitted: SubmittedFields,
): Assembled {
    // Spread the stored blob rather than building a fresh one: last_status and anything
    // else nothing declares would otherwise be dropped by saving an unrelated checkbox.
    const config: Record<string, unknown> = { ...(existing ?? {}) };

    for (const spec of writableKeys(type)) {
        const raw = submitted.config[spec.key];

        if (isTriState(spec)) {
            // Removing the key is the only way to say "inherit" - a stored false means
            // someone chose no, and showAdult() reads `config.nsfw ?? channel.nsfw`.
            if (raw === 'yes' || raw === 'no') config[spec.key] = raw === 'yes';
            else delete config[spec.key];
            continue;
        }

        // An unchecked box sends nothing at all, which is the whole point of writing every
        // key explicitly: "off" has to be stored, not inferred from an absence.
        config[spec.key] = raw === 'on' || raw === 'true';
    }

    if (config.sfw === false && config.nsfw === false) {
        return { ok: false, error: 'Hiding both safe and adult content would leave nothing for this feed to post.' };
    }

    const message = submitted.message.trim();
    if (message.length > MAX_MESSAGE_LENGTH) {
        return { ok: false, error: `The message is ${message.length} characters. Discord allows ${MAX_MESSAGE_LENGTH}.` };
    }

    return {
        ok: true,
        settings: {
            crosspost: submitted.crosspost,
            compact: submitted.compact,
            message: message === '' ? null : message,
            config,
        },
    };
}

/**
 * What actually changed, for the log line.
 *
 * Names only. The values are a server's posting preferences rather than anything secret,
 * but a log is the wrong place to accumulate them and the useful question later is which
 * field someone touched.
 */
export function changedFields(
    before: { crosspost: boolean; compact: boolean; message: string | null; config: Record<string, unknown> },
    after: SubscriptionSettings,
): string[] {
    const changed: string[] = [];
    if (before.crosspost !== after.crosspost) changed.push('crosspost');
    if (before.compact !== after.compact) changed.push('compact');
    if ((before.message ?? null) !== after.message) changed.push('message');

    const keys = new Set([...Object.keys(before.config ?? {}), ...Object.keys(after.config)]);
    for (const key of keys) {
        const had = Object.prototype.hasOwnProperty.call(before.config ?? {}, key);
        const has = Object.prototype.hasOwnProperty.call(after.config, key);
        if (had !== has || (before.config ?? {})[key] !== after.config[key]) changed.push(`config.${key}`);
    }

    return changed;
}
