'use client';

import { useEffect, useState } from 'react';
import { FORMAT } from '@/lib/timestamp';

/**
 * The visitor's own clock, which only the visitor's browser knows.
 *
 * The EJS did this with an inline <script> that read the ISO string back out of the DOM.
 * This is the same thing as a component, and the reason it is the page's only client
 * component: everything else on the page is the same for everyone.
 *
 * It renders the placeholder on the server and fills in after mount rather than
 * formatting during render, because the server's timezone is not the visitor's - React
 * would hydrate over a different string and warn, and for one frame the page would show a
 * confidently wrong local time.
 */
export function LocalTime({ ms, valid }: { ms: number; valid: boolean }) {
    const [local, setLocal] = useState<string | null>(null);
    const [zone, setZone] = useState<string | null>(null);

    useEffect(() => {
        setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown');
        if (!valid) { setLocal('Invalid date'); return; }
        setLocal(new Intl.DateTimeFormat(undefined, FORMAT).format(new Date(ms)));
    }, [ms, valid]);

    return (
        <>
            <h2 className="mt-1.5 text-heading-sm" suppressHydrationWarning>{local ?? '—'}</h2>
            <p className="mt-2 text-body-sm text-neutral-400">
                Detected timezone: <span suppressHydrationWarning>{zone ?? '-'}</span>
            </p>
        </>
    );
}
