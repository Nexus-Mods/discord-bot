'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';

/**
 * The tab strip on a guild's page.
 *
 * A client component, for one reason: switching tabs should not rebuild the rail. With
 * plain anchors every tab click was a full navigation, so the manage layout re-ran and
 * the server list was fetched again for a change of panel. next/link does a client
 * navigation instead, and Next re-uses the layouts above the segment that changed - the
 * rail is not re-rendered and Discord is not re-asked.
 *
 * Which also means the active tab can no longer come from the x-pathname header: the
 * layout that reads it does not re-render on a client navigation, so the highlight would
 * stick to whichever tab was open when the page loaded. useSelectedLayoutSegment reads
 * the live one. The rail's own pill still comes from the header, because switching server
 * IS a full navigation.
 *
 * Links, not buttons: each tab is a URL, so it is shareable, bookmarkable, and the back
 * button does what a person expects.
 */
export interface Tab {
    href: string;
    label: string;
    /** The route segment that makes this tab the active one. */
    segment: string;
}

export function Tabs({ tabs }: { tabs: Tab[] }) {
    // null when no tab is named - /manage/<id> renders the first tab's panel directly
    // rather than redirecting, so the first tab is what "no segment" means.
    const active = useSelectedLayoutSegment() ?? tabs[0]?.segment;

    return (
        <nav aria-label="Sections" className="mt-6 border-b border-neutral-700">
            <ul className="-mb-px flex gap-1">
                {tabs.map((tab) => {
                    const current = tab.segment === active;
                    return (
                        <li key={tab.href}>
                            <Link
                                href={tab.href}
                                // aria-current is what tells a screen reader which tab is
                                // open; the underline only tells a sighted user.
                                aria-current={current ? 'page' : undefined}
                                className={[
                                    'inline-block border-b-2 px-4 py-2 text-title-sm transition-colors',
                                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-subdued',
                                    current
                                        ? 'border-primary-400 text-neutral-50'
                                        : 'border-transparent text-neutral-400 hover:border-neutral-600 hover:text-neutral-50',
                                ].join(' ')}
                            >
                                {tab.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
