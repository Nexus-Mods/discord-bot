import type { Metadata } from 'next';
import { ActionButton, Content, PageTitle } from '@/components/ui';
import { one, type SearchParams } from '@/lib/search';
import { parseToMs, ukTime } from '@/lib/timestamp';
import { LocalTime } from './LocalTime';

/**
 * Ported from timestamp.ejs: paste a timestamp, get UK time and your own.
 *
 * The parser is lifted unchanged into lib/timestamp.ts - see the note there. The form is
 * still a GET to /timestamp with a `ts` field, so a bookmarked conversion keeps working
 * and the page needs no JavaScript to do its main job.
 *
 * force-dynamic because the default value of the result is "now": prerendered, this page
 * would be built once and then confidently report the time of the build.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Timestamp Converter' };

export default async function Timestamp({ searchParams }: { searchParams: SearchParams }) {
    const raw = one((await searchParams).ts) ?? '';
    const ms = parseToMs(raw);
    const date = new Date(ms);
    const valid = !isNaN(date.getTime());
    const iso = valid ? date.toISOString() : 'Invalid date';

    return (
        <Content>
            <PageTitle>Timestamp → UK time / Your local time</PageTitle>

            <div className="my-6 divide-y divide-neutral-700 rounded border border-neutral-700">
                <div className="p-4">
                    <p className="font-semibold">Your local time:</p>
                    <LocalTime ms={ms} valid={valid} />
                </div>
                <div className="p-4">
                    <p className="font-semibold">UK time (Europe/London):</p>
                    <p className="mt-1.5">{ukTime(date, iso)}</p>
                </div>
                <div className="p-4">
                    <p className="text-body-sm text-neutral-400">
                        <strong>Parsed UTC ISO:</strong>{' '}
                        <code className="font-mono">{iso}</code>
                    </p>
                </div>
            </div>

            <form method="get" action="/timestamp" className="flex flex-wrap items-end gap-3">
                <div className="grow">
                    <label htmlFor="ts" className="block text-body-md">Timestamp (seconds, ms or ISO):</label>
                    <input
                        id="ts"
                        name="ts"
                        type="text"
                        defaultValue={raw}
                        placeholder="e.g. 1763499600 or 1763499600000 or 2025-11-03T12:00:00Z"
                        className="mt-1.5 w-full max-w-xl rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-body-md text-neutral-100 placeholder:text-neutral-500 focus-visible:border-primary-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-subdued"
                    />
                </div>
                <ActionButton type="submit">Convert</ActionButton>
            </form>

            {/* The EJS had a second button that filled the field in with an example via an
                inline script. A link carries the same example, costs no JavaScript, and is
                something you can copy. */}
            <p className="mt-4 text-body-sm text-neutral-400">
                Example: <a href="/timestamp?ts=1763499600" className="text-primary-400 hover:text-primary-strong font-mono">1763499600</a>
            </p>
        </Content>
    );
}
