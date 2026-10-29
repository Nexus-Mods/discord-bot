'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveTrackedItem, deleteTrackedItem } from './actions';
import type { SaveState } from './actions';
import type { Preference } from '@/lib/manage/trackedItem';

/**
 * The editable half of a tracked item.
 *
 * One form, one Save button: a feed's options are read together - hiding adult content
 * and hiding safe content are only meaningful as a pair - so saving them one click at a
 * time would let the row pass through states nobody asked for. It also means one write
 * and one log line per edit.
 *
 * Everything here is a hint. The action re-reads the session, re-checks the permission and
 * re-finds the item; a disabled control is a courtesy to the person, not a guard.
 */

const idle: SaveState = { status: 'idle' };

function SaveButton({ dirty }: { dirty: boolean }) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending || !dirty}
            className="rounded bg-primary-600 px-4 py-2 text-title-sm text-neutral-50 hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
            {pending ? 'Saving…' : 'Save changes'}
        </button>
    );
}

function Toggle({ preference, disabled }: { preference: Preference; disabled: boolean }) {
    const id = `pref-${preference.name}`;
    return (
        <div className="flex items-start gap-3 p-4">
            <input
                type="checkbox"
                id={id}
                name={`config.${preference.name}`}
                defaultChecked={Boolean(preference.value)}
                disabled={disabled}
                className="mt-1 size-4 flex-none accent-primary-400 disabled:opacity-60"
            />
            <div className="min-w-0">
                <label htmlFor={id} className="text-title-sm">
                    {preference.label}
                    {preference.notImplemented && (
                        <span className="ml-2 text-body-xs font-normal text-neutral-500">not used yet</span>
                    )}
                </label>
                <p className="mt-1 text-body-sm text-neutral-400">
                    {preference.hint}
                    {preference.isSet === false && (
                        <span className="text-neutral-500"> Currently the default.</span>
                    )}
                </p>
            </div>
        </div>
    );
}

function TriState({ preference, disabled }: { preference: Preference; disabled: boolean }) {
    const id = `pref-${preference.name}`;
    const current = preference.isSet ? (preference.value ? 'yes' : 'no') : 'inherit';
    return (
        <div className="flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 grow">
                <label htmlFor={id} className="text-title-sm">{preference.label}</label>
                <p className="mt-1 text-body-sm text-neutral-400">{preference.hint}</p>
            </div>
            <select
                id={id}
                name={`config.${preference.name}`}
                defaultValue={current}
                disabled={disabled}
                className="rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-body-md disabled:opacity-60"
            >
                <option value="inherit">
                    Follow {preference.inherits ?? 'the default'}
                </option>
                <option value="yes">Include</option>
                <option value="no">Exclude</option>
            </select>
        </div>
    );
}

/** crosspost and compact are columns, so they are named plainly rather than under config. */
function ColumnToggle({ preference, disabled }: { preference: Preference; disabled: boolean }) {
    const id = `pref-${preference.name}`;
    return (
        <div className="flex items-start gap-3 p-4">
            <input
                type="checkbox"
                id={id}
                name={preference.name}
                defaultChecked={Boolean(preference.value)}
                disabled={disabled}
                className="mt-1 size-4 flex-none accent-primary-400 disabled:opacity-60"
            />
            <div className="min-w-0">
                <label htmlFor={id} className="text-title-sm">{preference.label}</label>
                <p className="mt-1 text-body-sm text-neutral-400">{preference.hint}</p>
            </div>
        </div>
    );
}

function TextField({ preference, disabled }: { preference: Preference; disabled: boolean }) {
    const id = `pref-${preference.name}`;
    return (
        <div className="p-4">
            <label htmlFor={id} className="text-title-sm">{preference.label}</label>
            <p className="mb-2 mt-1 text-body-sm text-neutral-400">{preference.hint}</p>
            <input
                type="text"
                id={id}
                name={preference.name}
                defaultValue={typeof preference.value === 'string' ? preference.value : ''}
                placeholder="Nothing set"
                maxLength={2000}
                disabled={disabled}
                className="w-full max-w-prose rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-body-md disabled:opacity-60"
            />
        </div>
    );
}

function Group({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <>
            <h3 className="mt-8 text-title-md">{title}</h3>
            <p className="mt-1 text-body-sm text-neutral-400">{description}</p>
            <div className="my-4 divide-y divide-neutral-700 rounded border border-neutral-700 bg-neutral-800/60">
                {children}
            </div>
        </>
    );
}

export function TrackedItemForm({
    guildId, itemId, itemTitle, feedOptions, discordOptions, canManage,
}: {
    guildId: string;
    itemId: number;
    itemTitle: string;
    feedOptions: Preference[];
    discordOptions: Preference[];
    canManage: boolean;
}) {
    const [state, action] = useActionState(saveTrackedItem, idle);
    // Any change at all, rather than a value comparison: a field returned to its original
    // value leaves Save enabled, which costs a no-op write the action discards anyway.
    const [dirty, setDirty] = useState(false);

    return (
        <form action={action} onChange={() => setDirty(true)} onSubmit={() => setDirty(false)}>
            <input type="hidden" name="guildId" value={guildId} />
            <input type="hidden" name="itemId" value={itemId} />

            <fieldset disabled={!canManage}>
                <legend className="sr-only">Settings for {itemTitle}</legend>

                {feedOptions.length > 0 && (
                    <Group title="Feed Options" description="What this feed posts.">
                        {feedOptions.map((preference) => (
                            preference.triState
                                ? <TriState key={preference.name} preference={preference} disabled={!canManage} />
                                : <Toggle key={preference.name} preference={preference} disabled={!canManage} />
                        ))}
                    </Group>
                )}

                <Group title="Discord Options" description="How it posts to Discord.">
                    {discordOptions.map((preference) => (
                        preference.kind === 'text'
                            ? <TextField key={preference.name} preference={preference} disabled={!canManage} />
                            : <ColumnToggle key={preference.name} preference={preference} disabled={!canManage} />
                    ))}
                </Group>
            </fieldset>

            {canManage && (
                <div className="flex flex-wrap items-center gap-4">
                    <SaveButton dirty={dirty} />
                    {state.status === 'error' && (
                        <p role="alert" className="text-body-sm text-warning-strong">{state.error}</p>
                    )}
                    {state.status === 'saved' && !dirty && (
                        <p role="status" className="text-body-sm text-neutral-400">Saved.</p>
                    )}
                </div>
            )}
        </form>
    );
}

/**
 * Removing a feed.
 *
 * Its own form, because a form cannot nest inside another, and deliberately two steps: it
 * is the only control on this page that cannot be undone by setting it back.
 */
export function DeleteTrackedItem({
    guildId, itemId, itemTitle,
}: { guildId: string; itemId: number; itemTitle: string }) {
    const [state, action] = useActionState(deleteTrackedItem, idle);
    const [confirming, setConfirming] = useState(false);

    if (!confirming) {
        return (
            <div className="mt-10 border-t border-neutral-700 py-6 ">
                <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="text-body-sm text-black hover:underline rounded bg-warning-strong px-4 py-2 text-title-sm hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Remove this feed
                </button>
            </div>
        );
    }

    return (
        <form action={action} className="mt-10 rounded border border-warning-900 bg-warning-900/20 p-4">
            <input type="hidden" name="guildId" value={guildId} />
            <input type="hidden" name="itemId" value={itemId} />
            <p className="text-body-md">
                Stop tracking <strong>{itemTitle}</strong>? Nothing already posted is removed, but
                this feed stops and its settings are gone.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                    type="submit"
                    className="rounded bg-warning-900 px-4 py-2 text-title-sm text-warning-strong hover:brightness-125"
                >
                    Remove feed
                </button>
                <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="text-body-sm text-neutral-400 hover:underline"
                >
                    Cancel
                </button>
                {state.status === 'error' && (
                    <p role="alert" className="text-body-sm text-warning-strong">{state.error}</p>
                )}
            </div>
        </form>
    );
}
