import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { ServerRail, ServerRailSkeleton } from '@/components/ServerRail';
import { currentSession } from '@/lib/auth/session';

/**
 * Everything under /manage is signed-in only, and shares the server rail.
 *
 * This layout awaits nothing but the session cookie, which is a decryption rather than a
 * round trip. The guild list is a call to Discord per manageable server, and awaiting it
 * here would hold the entire response - header, footer, content - until Discord answered.
 * So the rail fetches its own list behind a Suspense boundary and streams in.
 *
 * There is deliberately no loading.tsx beside this file. One here would wrap the guild
 * layout too, so its notFound() would arrive after the shell had already been flushed
 * with a 200 - and it flashed an index-shaped skeleton on the way to a server. The guild
 * segment has its own instead.
 *
 * The negative margins undo the padding the root layout puts on <main>, so the rail sits
 * flush; `grow` fills the height between the header and the footer, which needs <main> to
 * be a flex column - it is.
 */
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
    await connection();

    // The guard lives here rather than on each page: a page added under /manage later
    // inherits it instead of having to remember it.
    let session;
    try {
        session = await currentSession();
    }
    catch { /* an unreadable cookie is not signed in */ }
    if (!session) redirect('/');

    return (
        <div className="-mx-4 -mt-5 flex grow md:-mx-12 md:-mt-10">
            <Suspense fallback={<ServerRailSkeleton />}>
                <ServerRail />
            </Suspense>
            <div className="min-w-0 grow px-4 pt-5 md:px-10 md:pt-10">
                {children}
            </div>
        </div>
    );
}
