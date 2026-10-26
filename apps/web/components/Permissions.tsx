import type { ReactNode } from 'react';

/**
 * What this visitor may do in this server, stated once at the top rather than discovered
 * one disabled button at a time.
 */

/**
 * The tick and cross are decorative: a screen reader gets the words. An icon alone is not
 * an answer to "can I change this", and colour alone is not either - the yes/no text
 * carries the meaning for anyone who cannot separate the two greens from the reds.
 */
function Mark({ allowed, children }: { allowed: boolean; children: ReactNode }) {
    return (
        <li className="flex items-center gap-2 text-body-sm">
            <span
                aria-hidden
                className={`flex size-5 flex-none items-center justify-center rounded-full text-body-xs ${
                    allowed ? 'bg-success-900 text-success-strong' : 'bg-neutral-800 text-neutral-400'
                }`}
            >
                {allowed ? '✓' : '✗'}
            </span>
            <span className={allowed ? 'text-neutral-50' : 'text-neutral-400'}>
                {children}
                <span className="sr-only">{allowed ? ' — allowed' : ' — not allowed'}</span>
            </span>
        </li>
    );
}

export function PermissionSummary(
    { canManageFeeds, canManageSettings, owner }:
    { canManageFeeds: boolean; canManageSettings: boolean; owner: boolean },
) {
    return (
        <div className="mt-3">
            <h2 className="sr-only">What you can do in this server</h2>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <Mark allowed={canManageFeeds}>Manage tracked items</Mark>
                <Mark allowed={canManageSettings}>Manage settings</Mark>
            </ul>
            <p className="mt-2 text-body-sm text-neutral-400">
                {owner
                    ? 'You own this server, so everything here is open to you.'
                    : 'Set by your Discord permissions: Manage Channels for tracked items, Manage Server for settings.'}
            </p>
        </div>
    );
}
